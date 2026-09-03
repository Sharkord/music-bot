import {
  Permission,
  PluginSlot,
  type PluginContext,
  type UnloadPluginContext,
} from "@sharkord/plugin-sdk";
import type { PlayerActionResponse, TSharkord } from "../contract";
import {
  areRequiredBinariesPresent,
  downloadBinary,
  ensureRequiredBinaries,
  isBinaryDownloading,
  type TBinaryName,
} from "./downloads";
import { killMusicStream, spawnMusicStream } from "./ffmpeg";
import { setDataDir } from "./paths";
import {
  clearAllChannelStates,
  enqueueSource,
  formatSourceLabel,
  getChannelIds,
  getExistingState,
  getPlayerStateSnapshot,
  getState,
  removeQueueItem,
  takeNextFromQueue,
} from "./player-state";

type TMusicContext = PluginContext<TSharkord>;

type TCleanupContext = Pick<TMusicContext, "logger"> &
  Partial<Pick<TMusicContext, "push">>;

type PlaybackSettings = {
  bitrate: string;
  proxy?: string;
};

let binariesReady = false;
let binariesInitError: Error | null = null;

const publishPlayerState = (ctx: TCleanupContext, channelId: number): void => {
  ctx.push?.toAll({ channelId, player: getPlayerStateSnapshot(channelId) });
};

const cleanupChannel = (ctx: TCleanupContext, channelId: number): void => {
  const state = getExistingState(channelId);

  if (!state) return;

  killMusicStream(state.ffmpegProcess);

  state.ffmpegProcess = null;

  if (state.producerCloseHandler && state.audioProducer) {
    state.audioProducer.observer.off("close", state.producerCloseHandler);
  }

  if (state.routerCloseHandler && state.router) {
    state.router.off("@close", state.routerCloseHandler);
  }

  try {
    state.streamHandle?.remove();
  } catch {}

  try {
    state.audioProducer?.close();
  } catch {}

  try {
    state.audioTransport?.close();
  } catch {}

  state.streamHandle = null;
  state.audioProducer = null;
  state.audioTransport = null;
  state.router = null;
  state.routerCloseHandler = null;
  state.producerCloseHandler = null;
  state.streamActive = false;
  state.streamStarting = false;
  state.currentSong = null;
  state.currentInvokerUserId = null;
  state.currentThumbnailUrl = null;
  state.playbackStartedAtEpochMs = null;
  state.currentTrackDurationSeconds = null;

  publishPlayerState(ctx, channelId);
};

const startBinaryBootstrap = (ctx: TMusicContext): void => {
  binariesReady = false;
  binariesInitError = null;

  ensureRequiredBinaries(ctx.logger)
    .then(() => {
      binariesReady = true;
      ctx.logger.log("Required music binaries are ready");
    })
    .catch((err: unknown) => {
      binariesInitError = err instanceof Error ? err : new Error(String(err));
      ctx.logger.error("Failed to prepare required music binaries", err);
    });
};

const assertStreamingBinariesReady = async (): Promise<void> => {
  if (binariesInitError) {
    throw new Error(
      `Failed to prepare required binaries: ${binariesInitError.message}`,
    );
  }

  if (binariesReady || (await areRequiredBinariesPresent())) {
    binariesReady = true;
    return;
  }

  throw new Error(
    "Required music binaries are still downloading. Try again in a moment.",
  );
};

const requireVoiceChannelId = (
  channelId: number | null | undefined,
  errorMessage: string,
): number => {
  if (!channelId) {
    throw new Error(errorMessage);
  }

  return channelId;
};

const normalizePlayableSource = (query: string): string => {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    throw new Error("You must provide a search query or URL.");
  }

  if (!/^https?:\/\//.test(trimmedQuery)) {
    return `ytsearch:${trimmedQuery}`;
  }

  return trimmedQuery;
};

const buildActionResult = (
  ctx: TMusicContext,
  message: string,
  channelId: number,
): PlayerActionResponse => {
  publishPlayerState(ctx, channelId);

  return { message, player: getPlayerStateSnapshot(channelId) };
};

const startMusicStream = async (
  ctx: TMusicContext,
  channelId: number,
  sourceUrl: string,
  options: PlaybackSettings,
  invokerUserId: number,
): Promise<string> => {
  const state = getState(channelId);

  if (state.streamActive) {
    throw new Error("Music is already playing in this channel.");
  }

  if (state.streamStarting) {
    throw new Error("Music is already starting. Please wait.");
  }

  state.streamStarting = true;

  try {
    const router = ctx.voice.getRouter(channelId);
    const { announcedAddress, ip } = ctx.voice.getListenInfo();

    state.router = router;

    state.routerCloseHandler = () => {
      ctx.logger.log("Router closed, cleaning up channel", channelId);
      cleanupChannel(ctx, channelId);
    };

    router.on("@close", state.routerCloseHandler);

    const audioSsrc = Math.floor(Math.random() * 1e9);

    state.audioTransport = await router.createPlainTransport({
      listenIp: {
        ip,
        announcedIp: announcedAddress,
      },
      rtcpMux: true,
      comedia: true,
      enableSrtp: false,
    });

    state.audioProducer = await state.audioTransport.produce({
      kind: "audio",
      rtpParameters: {
        codecs: [
          {
            mimeType: "audio/opus",
            payloadType: 111,
            clockRate: 48000,
            channels: 2,
            parameters: {},
            rtcpFeedback: [],
          },
        ],
        encodings: [{ ssrc: audioSsrc }],
      },
    });

    ctx.logger.log("Final source URL:", sourceUrl);

    const result = await spawnMusicStream({
      sourceUrl,
      audioPayloadType: 111,
      audioSsrc,
      rtpHost: ip,
      audioRtpPort: state.audioTransport.tuple.localPort,
      volume: state.volume,
      bitrate: options.bitrate,
      proxy: options.proxy,
      log: ctx.logger.log,
      error: ctx.logger.error,
      debug: ctx.logger.debug,
      onEnd: () => {
        ctx.logger.log("Music ended in channel", channelId);

        const queueHasItems = state.queue.length > 0;
        const shouldStartNext =
          state.endAction === "next" ||
          (state.endAction !== "stop" && queueHasItems);

        state.endAction = "none";
        cleanupChannel(ctx, channelId);

        if (shouldStartNext) {
          playNextInQueue(ctx, channelId, options).catch((err: unknown) =>
            ctx.logger.error("Failed to start the next track", err),
          );
        }
      },
    });

    state.streamHandle = ctx.voice.createStream({
      key: "music",
      channelId,
      title: result.title,
      avatarUrl: "https://i.imgur.com/uVBNUK9.png",
      bannerUrl: result.thumbnailUrl,
      producers: {
        audio: state.audioProducer,
      },
    });

    state.producerCloseHandler = () => cleanupChannel(ctx, channelId);

    state.audioProducer.observer.on("close", state.producerCloseHandler);

    state.ffmpegProcess = result.process;
    state.currentSong = result.title;
    state.currentInvokerUserId = invokerUserId;
    state.currentThumbnailUrl = result.thumbnailUrl ?? null;
    state.playbackStartedAtEpochMs = Date.now();
    state.currentTrackDurationSeconds = result.durationSeconds ?? null;
    state.streamActive = true;
    state.endAction = "none";

    publishPlayerState(ctx, channelId);

    return `Now playing: ${result.title}`;
  } catch (err) {
    cleanupChannel(ctx, channelId);
    throw err;
  } finally {
    state.streamStarting = false;
  }
};

const playNextInQueue = async (
  ctx: TMusicContext,
  channelId: number,
  options: PlaybackSettings,
): Promise<string> => {
  const nextItem = takeNextFromQueue(channelId);

  if (!nextItem) {
    publishPlayerState(ctx, channelId);

    return "Queue is empty.";
  }

  return startMusicStream(
    ctx,
    channelId,
    nextItem.sourceUrl,
    options,
    nextItem.invokerUserId,
  );
};

const onLoad = async (ctx: TMusicContext) => {
  setDataDir(ctx.dataPath);
  startBinaryBootstrap(ctx);

  ctx.logger.log("Music Bot loaded");

  // the panel is only useful to someone who can be in a voice channel; owners
  // narrow this further per role in the plugin's permissions
  ctx.ui.enable({ [PluginSlot.TOPBAR_RIGHT]: Permission.JOIN_VOICE_CHANNELS });

  const settings = await ctx.settings.register([
    {
      key: "bitrate",
      name: "Bitrate",
      description: "The bitrate for the music stream",
      type: "string",
      defaultValue: "128k",
    },
    {
      key: "proxy",
      name: "Proxy URL",
      description:
        "Optional proxy URL for YouTube requests (e.g. http://localhost:8080)",
      type: "string",
      defaultValue: "",
    },
  ] as const);

  const getPlaybackSettings = (): PlaybackSettings => ({
    bitrate: settings.get("bitrate"),
    proxy: settings.get("proxy"),
  });

  ctx.events.on("voice:runtime_closed", ({ channelId }) => {
    const state = getExistingState(channelId);

    if (state) {
      state.endAction = "stop";
    }

    cleanupChannel(ctx, channelId);
  });

  ctx.actions.register({
    name: "getPlayerState",
    description: "Reads what is playing in the caller's voice channel",
    executes: async (invoker) =>
      getPlayerStateSnapshot(invoker.currentVoiceChannelId),
  });

  ctx.actions.register({
    name: "playMusic",
    description: "Plays a track, or queues it when something is already on",
    requires: Permission.JOIN_VOICE_CHANNELS,
    executes: async (invoker, payload) => {
      await assertStreamingBinariesReady();

      const channelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "You must be in a voice channel to play music.",
      );
      const sourceUrl = normalizePlayableSource(payload.query);
      const state = getState(channelId);

      if (state.streamActive || state.streamStarting) {
        const position = enqueueSource(channelId, sourceUrl, invoker.userId);

        return buildActionResult(
          ctx,
          `Added to queue (#${position}): ${formatSourceLabel(sourceUrl)}`,
          channelId,
        );
      }

      const message = await startMusicStream(
        ctx,
        channelId,
        sourceUrl,
        getPlaybackSettings(),
        invoker.userId,
      );

      return buildActionResult(ctx, message, channelId);
    },
  });

  ctx.actions.register({
    name: "removeQueueItem",
    description: "Removes one track from the queue",
    requires: Permission.JOIN_VOICE_CHANNELS,
    executes: async (invoker, payload) => {
      const channelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "You must be in a voice channel to edit the queue.",
      );
      const removedItem = removeQueueItem(channelId, payload.position);

      if (!removedItem) {
        throw new Error("Queue item not found.");
      }

      return buildActionResult(
        ctx,
        `Removed from queue: ${formatSourceLabel(removedItem.sourceUrl)}`,
        channelId,
      );
    },
  });

  ctx.actions.register({
    name: "nextMusic",
    description: "Skips to the next queued track",
    requires: Permission.JOIN_VOICE_CHANNELS,
    executes: async (invoker) => {
      await assertStreamingBinariesReady();

      const channelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "You must be in a voice channel to skip music.",
      );
      const state = getState(channelId);

      if (state.streamStarting) {
        throw new Error("Music is still starting. Try again in a moment.");
      }

      if (!state.streamActive) {
        const message = await playNextInQueue(
          ctx,
          channelId,
          getPlaybackSettings(),
        );

        return buildActionResult(ctx, message, channelId);
      }

      // the ffmpeg exit handler picks the next track up
      state.endAction = "next";
      cleanupChannel(ctx, channelId);

      return buildActionResult(ctx, "Skipping current track...", channelId);
    },
  });

  ctx.actions.register({
    name: "jumpToQueueItem",
    description: "Plays a queued track right away",
    requires: Permission.JOIN_VOICE_CHANNELS,
    executes: async (invoker, payload) => {
      await assertStreamingBinariesReady();

      const channelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "You must be in a voice channel to control the queue.",
      );
      const state = getState(channelId);
      const selectedItem = removeQueueItem(channelId, payload.position);

      if (!selectedItem) {
        throw new Error("Queue item not found.");
      }

      if (!state.streamActive) {
        const message = await startMusicStream(
          ctx,
          channelId,
          selectedItem.sourceUrl,
          getPlaybackSettings(),
          selectedItem.invokerUserId,
        );

        return buildActionResult(ctx, message, channelId);
      }

      state.queue.unshift(selectedItem);
      state.endAction = "next";
      cleanupChannel(ctx, channelId);

      return buildActionResult(
        ctx,
        `Jumping to: ${formatSourceLabel(selectedItem.sourceUrl)}`,
        channelId,
      );
    },
  });

  ctx.actions.register({
    name: "setVolume",
    description: "Sets the channel's master volume, used by the next track",
    requires: Permission.JOIN_VOICE_CHANNELS,
    executes: async (invoker, payload) => {
      const channelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "You must be in a voice channel to change the volume.",
      );

      if (!Number.isFinite(payload.volume)) {
        throw new Error("Volume must be a number between 0 and 100.");
      }

      const volume = Math.min(100, Math.max(0, Math.round(payload.volume)));

      getState(channelId).volume = volume;

      // ffmpeg bakes the volume filter in at spawn time, so the track already
      // playing keeps the level it started with
      return buildActionResult(
        ctx,
        `Volume set to ${volume}%. It applies from the next track.`,
        channelId,
      );
    },
  });

  ctx.actions.register({
    name: "stopMusic",
    description: "Stops playback and clears the channel's playback state",
    requires: Permission.JOIN_VOICE_CHANNELS,
    executes: async (invoker) => {
      const channelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "You must be in a voice channel to stop music.",
      );
      const state = getExistingState(channelId);

      if (state) {
        state.endAction = "stop";
      }

      // unconditional, so a half started stream is recoverable too
      cleanupChannel(ctx, channelId);

      return buildActionResult(ctx, "Stopped music.", channelId);
    },
  });

  const registerUpdateCommand = (
    name: "update-ffmpeg" | "update-yt-dlp",
    binary: TBinaryName,
  ) =>
    ctx.commands.register({
      name,
      description: `Downloads the latest ${binary} build`,
      requires: Permission.MANAGE_PLUGINS,
      executes: async () => {
        if (isBinaryDownloading(binary)) {
          return `${binary} is already downloading. Follow it in the plugin logs.`;
        }

        downloadBinary(binary, ctx.logger)
          .then(async () => {
            ctx.logger.log(`Updated ${binary} to the latest build`);

            // a manual download is also how you recover from a failed bootstrap
            binariesInitError = null;
            binariesReady = await areRequiredBinariesPresent();
          })
          .catch((err: unknown) =>
            ctx.logger.error(`Failed to update ${binary}`, err),
          );

        return `Downloading the latest ${binary}. Follow it in the plugin logs.`;
      },
    });

  registerUpdateCommand("update-ffmpeg", "ffmpeg");
  registerUpdateCommand("update-yt-dlp", "yt-dlp");
};

const onUnload = (ctx: UnloadPluginContext) => {
  for (const channelId of getChannelIds()) {
    const state = getExistingState(channelId);

    if (state) {
      state.endAction = "stop";
    }

    cleanupChannel(ctx, channelId);
  }

  clearAllChannelStates();

  ctx.logger.log("Music Bot unloaded");
};

export { onLoad, onUnload };

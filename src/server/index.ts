import {
  createRegisterAction,
  type PluginContext,
  type TInvokerContext,
} from "@sharkord/plugin-sdk";
import type { Commands } from "../contracts/commands";
import type { Actions } from "../contracts/actions";
import { killMusicStream, spawnMusicStream } from "./ffmpeg";
import {
  areRequiredBinariesPresent,
  ensureRequiredBinaries,
} from "./downloads";
import {
  clearAllChannelStates,
  clearQueue,
  enqueueSource,
  formatSourceLabel,
  getChannelIds,
  getExistingState,
  getPlayerStateSnapshot,
  getState,
  removeQueueItem,
  takeNextFromQueue,
} from "./player-state";

let debug = false;
let binariesReady = false;
let binariesInitError: Error | null = null;

const cleanupChannel = (channelId: number) => {
  const state = getExistingState(channelId);

  if (!state) return;

  killMusicStream(state.ffmpegProcess);

  state.ffmpegProcess = null;

  if (state.producerCloseHandler && state.audioProducer) {
    state.audioProducer.observer.off("close", state.producerCloseHandler);
  }

  if (state.routerCloseHandler) {
    state.router.off("@close", state.routerCloseHandler);
  }

  try {
    state.audioProducer?.close();
  } catch {}

  try {
    state.audioTransport?.close();
  } catch {}

  state.audioProducer = null;
  state.audioTransport = null;
  state.router = null;
  state.routerCloseHandler = null;
  state.producerCloseHandler = null;
  state.streamActive = false;
  state.currentSong = null;
  state.currentInvokerUserId = null;
  state.currentThumbnailUrl = null;
  state.streamStarting = false;
  state.playbackStartedAtEpochMs = null;
  state.currentTrackDurationSeconds = null;
};

const forceClean = () => {
  for (const channelId of getChannelIds()) {
    const state = getExistingState(channelId);

    if (state) {
      state.endAction = "stop";
    }

    cleanupChannel(channelId);
  }

  try {
    Bun.spawnSync({ cmd: ["killall", "ffmpeg"] });
  } catch {}

  clearAllChannelStates();
};

const startBinaryBootstrap = (ctx: PluginContext): void => {
  binariesReady = false;
  binariesInitError = null;

  ensureRequiredBinaries(ctx)
    .then(() => {
      binariesReady = true;
      ctx.log("Required music binaries are ready");
    })
    .catch((err: unknown) => {
      binariesInitError = err instanceof Error ? err : new Error(String(err));
      ctx.error("Failed to prepare required music binaries", err);
    });
};

const assertStreamingBinariesReady = async () => {
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

type StartMusicStreamOptions = {
  bitrate: string;
  proxy?: string;
};

type ControlPermissions = {
  roleId: number;
  hideButtonWhenNoPermission: boolean;
};

const getPlaybackSettings = async (
  settings: Awaited<ReturnType<PluginContext["settings"]["register"]>>,
): Promise<StartMusicStreamOptions> => {
  const [bitrate, proxy] = await Promise.all([
    settings.get("bitrate"),
    settings.get("proxy"),
  ]);

  return { bitrate, proxy };
};

const getControlPermissions = async (
  settings: Awaited<ReturnType<PluginContext["settings"]["register"]>>,
): Promise<ControlPermissions> => {
  const [roleId, hideButtonWhenNoPermission] = await Promise.all([
    settings.get("roleId"),
    settings.get("hideButtonWhenNoPermission"),
  ]);

  return {
    roleId: Number(roleId),
    hideButtonWhenNoPermission: Boolean(hideButtonWhenNoPermission),
  };
};

const getInvokerRoleIds = async (
  ctx: PluginContext,
  userId: number,
): Promise<number[]> => {
  try {
    const user = (await ctx.data.getUser(userId)) as {
      roleIds: number[];
    };

    return user.roleIds;
  } catch {
    return [];
  }
};

const assertCanControlMusic = async (
  ctx: PluginContext,
  invoker: TInvokerContext,
  settings: Awaited<ReturnType<PluginContext["settings"]["register"]>>,
): Promise<void> => {
  const { roleId } = await getControlPermissions(settings);

  if (roleId === -1) {
    return;
  }

  const roleIds = await getInvokerRoleIds(ctx, invoker.userId);

  if (!roleIds.includes(roleId)) {
    throw new Error("You don't have permission to control the music bot.");
  }
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

const getRequiredText = (value: string | undefined, errorMessage: string) => {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    throw new Error(errorMessage);
  }

  return trimmedValue;
};

const normalizePlayableSource = (query: string): string => {
  if (!/^https?:\/\//.test(query)) {
    return `ytsearch:${query}`;
  }

  return query;
};

const addSourceToQueue = (
  channelId: number,
  sourceUrl: string,
  invokerUserId: number,
): string => {
  const position = enqueueSource(channelId, sourceUrl, invokerUserId);

  return `Added to queue (#${position}): ${formatSourceLabel(sourceUrl)}`;
};

const buildActionResult = (message: string, channelId?: number | null) => ({
  message,
  player: getPlayerStateSnapshot(channelId),
});

const removeQueuedSource = (channelId: number, position: number): string => {
  const removedItem = removeQueueItem(channelId, position);

  if (!removedItem) {
    throw new Error("Queue item not found.");
  }

  return `Removed from queue: ${formatSourceLabel(removedItem.sourceUrl)}`;
};

const playQueuedSourceImmediately = async (
  ctx: PluginContext,
  channelId: number,
  position: number,
  settings: Awaited<ReturnType<PluginContext["settings"]["register"]>>,
): Promise<string> => {
  const state = getState(channelId);
  const selectedItem = removeQueueItem(channelId, position);

  if (!selectedItem) {
    throw new Error("Queue item not found.");
  }

  const playbackSettings = await getPlaybackSettings(settings);

  if (!state.streamActive) {
    return startMusicStream(
      ctx,
      channelId,
      selectedItem.sourceUrl,
      playbackSettings,
      selectedItem.invokerUserId,
    );
  }

  state.queue.unshift(selectedItem);
  state.endAction = "next";
  cleanupChannel(channelId);

  return `Jumping to: ${formatSourceLabel(selectedItem.sourceUrl)}`;
};

const skipToNextTrack = async (
  ctx: PluginContext,
  channelId: number,
  settings: Awaited<ReturnType<PluginContext["settings"]["register"]>>,
): Promise<string> => {
  const state = getState(channelId);
  const playbackSettings = await getPlaybackSettings(settings);

  if (state.streamStarting) {
    throw new Error("Music is still starting. Try again in a moment.");
  }

  if (!state.streamActive) {
    return playNextInQueue(ctx, channelId, playbackSettings);
  }

  state.endAction = "next";
  cleanupChannel(channelId);

  return "Skipping current track...";
};

const playOrQueueSource = async (
  ctx: PluginContext,
  channelId: number,
  sourceUrl: string,
  settings: Awaited<ReturnType<PluginContext["settings"]["register"]>>,
  invokerUserId: number,
) => {
  const state = getState(channelId);

  if (state.streamActive || state.streamStarting) {
    return addSourceToQueue(channelId, sourceUrl, invokerUserId);
  }

  const playbackSettings = await getPlaybackSettings(settings);

  return startMusicStream(
    ctx,
    channelId,
    sourceUrl,
    playbackSettings,
    invokerUserId,
  );
};

const startMusicStream = async (
  ctx: PluginContext,
  channelId: number,
  sourceUrl: string,
  options: StartMusicStreamOptions,
  invokerUserId: number,
) => {
  const state = getState(channelId);

  if (state.streamActive) {
    throw new Error(
      "Music is already playing in this channel. Use /stop first.",
    );
  }

  if (state.streamStarting) {
    throw new Error("Music is already starting. Please wait.");
  }

  state.streamStarting = true;

  try {
    const router = ctx.voice.getRouter(channelId);

    if (!router) throw new Error("Could not access voice channel");

    const { announcedAddress, ip } = await ctx.voice.getListenInfo();

    state.router = router;

    state.routerCloseHandler = () => {
      ctx.log("Router closed, cleaning up channel", channelId);
      cleanupChannel(channelId);
    };

    state.router.on("@close", state.routerCloseHandler);

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

    ctx.log("Final source URL:", sourceUrl);

    const result = await spawnMusicStream({
      sourceUrl,
      audioPayloadType: 111,
      audioSsrc,
      rtpHost: ip,
      audioRtpPort: state.audioTransport.tuple.localPort,
      volume: state.volume,
      bitrate: options.bitrate,
      proxy: options.proxy,
      error: (...m) => ctx.error(...m),
      log: (...m) => ctx.log(...m),
      debug: (...m) => {
        if (debug) {
          ctx.debug(...m);
        }
      },
      onEnd: () => {
        ctx.log("Music ended in channel", channelId);
        const queueHasItems = state.queue.length > 0;
        const shouldStartNext =
          state.endAction === "next" ||
          (state.endAction !== "stop" && queueHasItems);

        state.endAction = "none";
        cleanupChannel(channelId);

        if (shouldStartNext) {
          playNextInQueue(ctx, channelId, options);
        }
      },
    });

    ctx.voice.createStream({
      key: "music",
      channelId,
      title: result.title,
      avatarUrl: "https://i.imgur.com/uVBNUK9.png",
      bannerUrl: result.thumbnailUrl,
      producers: {
        audio: state.audioProducer,
      },
    });

    state.producerCloseHandler = () => cleanupChannel(channelId);

    state.audioProducer.observer.on("close", state.producerCloseHandler);

    state.ffmpegProcess = result.process;
    state.currentSong = result.title;
    state.currentInvokerUserId = invokerUserId;
    state.currentThumbnailUrl = result.thumbnailUrl ?? null;
    state.playbackStartedAtEpochMs = Date.now();
    state.currentTrackDurationSeconds = result.durationSeconds ?? null;
    state.streamActive = true;
    state.endAction = "none";

    return `Now playing: ${result.title}`;
  } catch (err) {
    cleanupChannel(channelId);
    throw err;
  } finally {
    state.streamStarting = false;
  }
};

const playNextInQueue = async (
  ctx: PluginContext,
  channelId: number,
  options: StartMusicStreamOptions,
): Promise<string> => {
  const nextItem = takeNextFromQueue(channelId);

  if (!nextItem) {
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

const onLoad = async (ctx: PluginContext) => {
  startBinaryBootstrap(ctx);

  ctx.log("Music Bot loaded");

  ctx.ui.enable();

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
    {
      key: "roleId",
      name: "Role ID",
      description:
        "Control which role can control the music bot. If set to -1, everyone can control it.",
      type: "number",
      defaultValue: -1,
    },
    {
      key: "hideButtonWhenNoPermission",
      name: "Hide Player For Non-Permitted Users",
      description:
        "When enabled and roleId is set, users without permission to control the bot won't see the player button. If disabled, the player button will be visible but non-permitted users won't be able to interact with it.",
      type: "boolean",
      defaultValue: false,
    },
  ]);

  ctx.events.on("voice:runtime_closed", ({ channelId }) => {
    const state = getExistingState(channelId);

    if (state) {
      state.endAction = "stop";
    }

    cleanupChannel(channelId);
  });

  const registerAction = createRegisterAction<Actions>(ctx);

  registerAction("getPlayerState", async (invoker) => {
    return getPlayerStateSnapshot(invoker.currentVoiceChannelId);
  });

  registerAction("cleanChannel", async (invoker) => {
    await assertCanControlMusic(ctx, invoker, settings);

    const channelId = requireVoiceChannelId(
      invoker.currentVoiceChannelId,
      "You must be in a voice channel to clean playback state.",
    );
    const state = getExistingState(channelId);

    if (state) {
      state.endAction = "stop";
    }

    cleanupChannel(channelId);

    return buildActionResult(
      "Cleaned playback state for this channel.",
      channelId,
    );
  });

  registerAction("playMusic", async (invoker, payload) => {
    await assertStreamingBinariesReady();
    await assertCanControlMusic(ctx, invoker, settings);

    const channelId = requireVoiceChannelId(
      invoker.currentVoiceChannelId,
      "You must be in a voice channel to play music.",
    );
    const query = getRequiredText(
      payload.query,
      "You must provide a search query or URL.",
    );
    const sourceUrl = normalizePlayableSource(query);
    const message = await playOrQueueSource(
      ctx,
      channelId,
      sourceUrl,
      settings,
      invoker.userId,
    );

    return buildActionResult(message, channelId);
  });

  registerAction("queueMusic", async (invoker, payload) => {
    await assertStreamingBinariesReady();
    await assertCanControlMusic(ctx, invoker, settings);

    const channelId = requireVoiceChannelId(
      invoker.currentVoiceChannelId,
      "You must be in a voice channel to queue music.",
    );
    const query = getRequiredText(
      payload.query,
      "You must provide a search query or URL.",
    );
    const sourceUrl = normalizePlayableSource(query);
    const message = addSourceToQueue(channelId, sourceUrl, invoker.userId);

    return buildActionResult(message, channelId);
  });

  registerAction("removeQueueItem", async (invoker, payload) => {
    await assertCanControlMusic(ctx, invoker, settings);

    const channelId = requireVoiceChannelId(
      invoker.currentVoiceChannelId,
      "You must be in a voice channel to edit the queue.",
    );
    const message = removeQueuedSource(channelId, payload.position);

    return buildActionResult(message, channelId);
  });

  registerAction("nextMusic", async (invoker) => {
    await assertStreamingBinariesReady();
    await assertCanControlMusic(ctx, invoker, settings);

    const channelId = requireVoiceChannelId(
      invoker.currentVoiceChannelId,
      "You must be in a voice channel to skip music.",
    );
    const message = await skipToNextTrack(ctx, channelId, settings);

    return buildActionResult(message, channelId);
  });

  registerAction("jumpToQueueItem", async (invoker, payload) => {
    await assertStreamingBinariesReady();
    await assertCanControlMusic(ctx, invoker, settings);

    const channelId = requireVoiceChannelId(
      invoker.currentVoiceChannelId,
      "You must be in a voice channel to control the queue.",
    );
    const message = await playQueuedSourceImmediately(
      ctx,
      channelId,
      payload.position,
      settings,
    );

    return buildActionResult(message, channelId);
  });

  registerAction("stopMusic", async (invoker) => {
    await assertCanControlMusic(ctx, invoker, settings);

    const channelId = requireVoiceChannelId(
      invoker.currentVoiceChannelId,
      "You must be in a voice channel to stop music.",
    );
    const state = getExistingState(channelId);

    if (!state || !state.streamActive) {
      return buildActionResult(
        "No active music stream in this channel.",
        channelId,
      );
    }

    state.endAction = "stop";
    cleanupChannel(channelId);

    return buildActionResult("Stopped music.", channelId);
  });

  registerAction("getControlPermissions", async () => {
    return getControlPermissions(settings);
  });
};

const onUnload = (ctx: PluginContext) => {
  for (const channelId of getChannelIds()) {
    cleanupChannel(channelId);
  }

  clearAllChannelStates();

  ctx.log("Music Bot unloaded");
};

export { onLoad, onUnload };

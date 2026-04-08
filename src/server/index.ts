import {
  createRegisterCommand,
  type AppData,
  type PlainTransport,
  type PluginContext,
  type Producer,
} from "@sharkord/plugin-sdk";
import type { Commands } from "../contracts/commands";
import {
  killMusicStream,
  spawnMusicStream,
  type TMusicStreamResult,
} from "./ffmpeg";
import {
  areRequiredBinariesPresent,
  ensureRequiredBinaries,
} from "./downloads";
import { isYouTubeUrl } from "./yt-dlp";

let debug = false;
let binariesReady = false;
let binariesInitError: Error | null = null;

type TQueueItem = {
  sourceUrl: string;
};

type ChannelStreamState = {
  ffmpegProcess: TMusicStreamResult["process"] | null;
  audioProducer: Producer | null;
  audioTransport: PlainTransport<AppData> | null;
  router: any;
  routerCloseHandler: ((...args: unknown[]) => void) | null;
  producerCloseHandler: ((...args: unknown[]) => void) | null;
  currentSong: string | null;
  streamActive: boolean;
  streamStarting: boolean;
  volume: number;
  queue: TQueueItem[];
  endAction: "none" | "next";
};

const channelStreams = new Map<number, ChannelStreamState>();

const getState = (channelId: number): ChannelStreamState => {
  let state = channelStreams.get(channelId);

  if (!state) {
    state = {
      ffmpegProcess: null,
      audioProducer: null,
      audioTransport: null,
      router: null,
      routerCloseHandler: null,
      producerCloseHandler: null,
      currentSong: null,
      streamActive: false,
      streamStarting: false,
      volume: 50,
      queue: [],
      endAction: "none",
    };

    channelStreams.set(channelId, state);
  }

  return state;
};

const formatSourceLabel = (sourceUrl: string): string => {
  if (sourceUrl.startsWith("ytsearch:")) {
    return sourceUrl.slice("ytsearch:".length);
  }

  return sourceUrl;
};

const enqueueSource = (channelId: number, sourceUrl: string): number => {
  const state = getState(channelId);
  state.queue.push({ sourceUrl });
  return state.queue.length;
};

const takeNextFromQueue = (channelId: number): TQueueItem | null => {
  const state = getState(channelId);
  return state.queue.shift() ?? null;
};

const buildQueueText = (channelId: number): string => {
  const state = getState(channelId);

  if (!state.streamActive && state.queue.length === 0) {
    return "Queue is empty.";
  }

  const lines: string[] = [];

  if (state.streamActive && state.currentSong) {
    lines.push(`Now playing: ${state.currentSong}`);
  }

  if (state.queue.length === 0) {
    lines.push("Queue: (empty)");
    return lines.join("\n");
  }

  lines.push("Queue:");

  for (const [index, item] of state.queue.entries()) {
    lines.push(`${index + 1}. ${formatSourceLabel(item.sourceUrl)}`);
  }

  return lines.join("\n");
};

const cleanupChannel = (channelId: number) => {
  const state = channelStreams.get(channelId);

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
  state.streamStarting = false;
};

const forceClean = () => {
  for (const channelId of channelStreams.keys()) {
    cleanupChannel(channelId);
  }

  try {
    Bun.spawnSync({ cmd: ["killall", "ffmpeg"] });
  } catch {}

  channelStreams.clear();
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

const getPlaybackSettings = async (
  settings: Awaited<ReturnType<PluginContext["settings"]["register"]>>,
): Promise<StartMusicStreamOptions> => {
  const [bitrate, proxy] = await Promise.all([
    settings.get("bitrate"),
    settings.get("proxy"),
  ]);

  return { bitrate, proxy };
};

const startMusicStream = async (
  ctx: PluginContext,
  channelId: number,
  sourceUrl: string,
  options: StartMusicStreamOptions,
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
        const shouldStartNext = state.endAction === "next" || queueHasItems;

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
    state.streamActive = true;

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

  return startMusicStream(ctx, channelId, nextItem.sourceUrl, options);
};

const onLoad = async (ctx: PluginContext) => {
  startBinaryBootstrap(ctx);

  ctx.log("Music Bot loaded");

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
  ]);

  ctx.events.on("voice:runtime_closed", ({ channelId }) => {
    cleanupChannel(channelId);
  });

  const registerCommand = createRegisterCommand<Commands>(ctx);

  registerCommand(
    "play",
    {
      description: "Play music from YouTube",
      args: [
        {
          name: "query",
          description: "YouTube URL, search query, or direct audio URL",
          type: "string",
          required: true,
        },
      ],
    },
    async (invoker, input) => {
      await assertStreamingBinariesReady();

      const channelId = invoker.currentVoiceChannelId;

      if (!channelId) {
        throw new Error("You must be in a voice channel to play music.");
      }

      if (!input.query) {
        throw new Error("You must provide a search query or URL.");
      }

      ctx.log(`Query: ${input.query} in channel ${channelId}`);

      let sourceUrl = input.query;

      if (!/^https?:\/\//.test(sourceUrl)) {
        sourceUrl = `ytsearch:${sourceUrl}`;
      }

      const state = getState(channelId);

      if (state.streamActive || state.streamStarting) {
        const position = enqueueSource(channelId, sourceUrl);
        return `Added to queue (#${position}): ${formatSourceLabel(sourceUrl)}`;
      }

      const playbackSettings = await getPlaybackSettings(settings);

      return startMusicStream(ctx, channelId, sourceUrl, playbackSettings);
    },
  );

  registerCommand(
    "play_direct",
    {
      description: "Play music from a direct URL (e.g. MP3 file)",
      args: [
        {
          name: "url",
          description: "Direct MP3 URL",
          type: "string",
          required: true,
        },
      ],
    },
    async (invoker, input) => {
      await assertStreamingBinariesReady();

      const channelId = invoker.currentVoiceChannelId;

      if (!channelId) {
        throw new Error("You must be in a voice channel to play music.");
      }

      if (!input.url) {
        throw new Error("You must provide a direct audio URL.");
      }

      if (!/^https?:\/\//.test(input.url)) {
        throw new Error("You must provide a direct http(s) URL.");
      }

      if (isYouTubeUrl(input.url)) {
        throw new Error("YouTube URLs are not supported by /play_direct.");
      }

      ctx.log(`Direct URL: ${input.url} in channel ${channelId}`);

      const state = getState(channelId);

      if (state.streamActive || state.streamStarting) {
        const position = enqueueSource(channelId, input.url);
        return `Added to queue (#${position}): ${formatSourceLabel(input.url)}`;
      }

      const playbackSettings = await getPlaybackSettings(settings);

      return startMusicStream(ctx, channelId, input.url, playbackSettings);
    },
  );

  registerCommand(
    "stop",
    {
      description: "Stop the music stream in the current channel",
      args: undefined,
    },
    async (invoker) => {
      const channelId = invoker.currentVoiceChannelId;

      if (!channelId) {
        throw new Error("You must be in a voice channel to stop music.");
      }

      const state = channelStreams.get(channelId);

      if (!state || !state.streamActive) {
        throw new Error("No active music stream in this channel.");
      }

      state.endAction = "none";
      cleanupChannel(channelId);
    },
  );

  registerCommand(
    "next",
    {
      description: "Skip current song and play the next queued item",
      args: undefined,
    },
    async (invoker) => {
      await assertStreamingBinariesReady();

      const channelId = invoker.currentVoiceChannelId;

      if (!channelId) {
        throw new Error("You must be in a voice channel to skip music.");
      }

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
    },
  );

  registerCommand(
    "clear_queue",
    {
      description: "Clear all queued songs for this channel",
      args: undefined,
    },
    async (invoker) => {
      const channelId = invoker.currentVoiceChannelId;

      if (!channelId) {
        throw new Error("You must be in a voice channel to clear the queue.");
      }

      const state = getState(channelId);
      const cleared = state.queue.length;

      state.queue = [];

      return cleared > 0
        ? `Cleared ${cleared} queued item(s).`
        : "Queue is already empty.";
    },
  );

  registerCommand(
    "queue",
    {
      description: "Show the current playback queue",
      args: undefined,
    },
    async (invoker) => {
      const channelId = invoker.currentVoiceChannelId;

      if (!channelId) {
        throw new Error("You must be in a voice channel to view the queue.");
      }

      return buildQueueText(channelId);
    },
  );

  registerCommand(
    "music_clean",
    {
      description:
        "Force clean all music streams (use if something gets stuck)",
      args: undefined,
    },
    async () => {
      forceClean();
    },
  );

  registerCommand(
    "volume",
    {
      description: "Set the music stream volume (0-100)",
      args: [
        {
          name: "volume",
          description: "Volume percentage (0-100)",
          type: "number",
          required: true,
        },
      ],
    },
    async (invoker, input) => {
      const channelId = invoker.currentVoiceChannelId;

      if (!channelId) throw new Error("You are not in a voice channel");

      if (input.volume < 0 || input.volume > 100) {
        throw new Error("Volume must be between 0 and 100");
      }

      const state = getState(channelId);

      state.volume = input.volume;

      return `Volume set to ${input.volume}% (applies to next song)`;
    },
  );

  registerCommand(
    "now_playing",
    {
      description: "Show the currently playing song in this channel",
      args: undefined,
    },
    async (invoker) => {
      const channelId = invoker.currentVoiceChannelId;

      if (!channelId) throw new Error("You are not in a voice channel");

      const state = channelStreams.get(channelId);

      if (!state || !state.streamActive || !state.currentSong) {
        return "No music is currently playing in this channel.";
      }

      return `Now playing: ${state.currentSong}`;
    },
  );
};

const onUnload = (ctx: PluginContext) => {
  for (const channelId of channelStreams.keys()) {
    cleanupChannel(channelId);
  }

  channelStreams.clear();

  ctx.log("Music Bot unloaded");
};

export { onLoad, onUnload };

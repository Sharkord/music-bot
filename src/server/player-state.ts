import type {
  AppData,
  PlainTransport,
  Producer,
} from "@sharkord/plugin-sdk";
import type {
  PlayerQueueEntry,
  PlayerStateSnapshot,
} from "../contracts/actions";
import type { TMusicStreamResult } from "./ffmpeg";

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
  currentThumbnailUrl: string | null;
  streamActive: boolean;
  streamStarting: boolean;
  playbackStartedAtEpochMs: number | null;
  currentTrackDurationSeconds: number | null;
  volume: number;
  queue: TQueueItem[];
  endAction: "none" | "next" | "stop";
};

const channelStreams = new Map<number, ChannelStreamState>();

const createInitialState = (): ChannelStreamState => ({
  ffmpegProcess: null,
  audioProducer: null,
  audioTransport: null,
  router: null,
  routerCloseHandler: null,
  producerCloseHandler: null,
  currentSong: null,
  currentThumbnailUrl: null,
  streamActive: false,
  streamStarting: false,
  playbackStartedAtEpochMs: null,
  currentTrackDurationSeconds: null,
  volume: 50,
  queue: [],
  endAction: "none",
});

const getState = (channelId: number): ChannelStreamState => {
  let state = channelStreams.get(channelId);

  if (!state) {
    state = createInitialState();
    channelStreams.set(channelId, state);
  }

  return state;
};

const getExistingState = (channelId: number): ChannelStreamState | undefined =>
  channelStreams.get(channelId);

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

const clearQueue = (channelId: number): number => {
  const state = getState(channelId);
  const cleared = state.queue.length;

  state.queue = [];

  return cleared;
};

const removeQueueItem = (
  channelId: number,
  position: number,
): TQueueItem | null => {
  const state = getState(channelId);
  const queueIndex = position - 1;

  if (!Number.isInteger(position) || queueIndex < 0 || queueIndex >= state.queue.length) {
    return null;
  }

  const [removedItem] = state.queue.splice(queueIndex, 1);

  return removedItem ?? null;
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

const buildQueueEntries = (state: ChannelStreamState): PlayerQueueEntry[] =>
  state.queue.map((item, index) => ({
    position: index + 1,
    label: formatSourceLabel(item.sourceUrl),
  }));

const emptyPlayerStateSnapshot = (): PlayerStateSnapshot => ({
  currentSong: null,
  currentThumbnailUrl: null,
  streamActive: false,
  streamStarting: false,
  playbackStartedAtEpochMs: null,
  currentTrackDurationSeconds: null,
  currentTrackEndsAtEpochMs: null,
  queue: [],
  queueText: "Queue is empty.",
});

const getPlayerStateSnapshot = (
  channelId?: number | null,
): PlayerStateSnapshot => {
  if (!channelId) {
    return emptyPlayerStateSnapshot();
  }

  const state = getState(channelId);

  return {
    currentSong: state.currentSong,
    currentThumbnailUrl: state.currentThumbnailUrl,
    streamActive: state.streamActive,
    streamStarting: state.streamStarting,
    playbackStartedAtEpochMs: state.playbackStartedAtEpochMs,
    currentTrackDurationSeconds: state.currentTrackDurationSeconds,
    currentTrackEndsAtEpochMs:
      state.playbackStartedAtEpochMs !== null && state.currentTrackDurationSeconds !== null
        ? state.playbackStartedAtEpochMs + state.currentTrackDurationSeconds * 1000
        : null,
    queue: buildQueueEntries(state),
    queueText: buildQueueText(channelId),
  };
};

const getChannelIds = (): number[] => Array.from(channelStreams.keys());

const clearAllChannelStates = (): void => {
  channelStreams.clear();
};

export {
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
};
export type { ChannelStreamState };
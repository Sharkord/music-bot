type PlayerQueueEntry = {
  position: number;
  label: string;
  invokerUserId: number;
};

type PlayerStateSnapshot = {
  currentSong: string | null;
  currentInvokerUserId: number | null;
  currentThumbnailUrl: string | null;
  streamActive: boolean;
  streamStarting: boolean;
  playbackStartedAtEpochMs: number | null;
  currentTrackDurationSeconds: number | null;
  volume: number;
  queue: PlayerQueueEntry[];
};

type PlayerActionResponse = {
  message: string;
  player: PlayerStateSnapshot;
};

type TSharkord = {
  actions: {
    getPlayerState: {
      payload: void;
      response: PlayerStateSnapshot;
    };
    playMusic: {
      payload: { query: string };
      response: PlayerActionResponse;
    };
    removeQueueItem: {
      payload: { position: number };
      response: PlayerActionResponse;
    };
    nextMusic: {
      payload: void;
      response: PlayerActionResponse;
    };
    jumpToQueueItem: {
      payload: { position: number };
      response: PlayerActionResponse;
    };
    stopMusic: {
      payload: void;
      response: PlayerActionResponse;
    };
    setVolume: {
      payload: { volume: number };
      response: PlayerActionResponse;
    };
  };
  commands: {
    "update-ffmpeg": {
      args: void;
      response: string;
    };
    "update-yt-dlp": {
      args: void;
      response: string;
    };
  };
  push: {
    channelId: number;
    player: PlayerStateSnapshot;
  };
};

export type {
  PlayerActionResponse,
  PlayerQueueEntry,
  PlayerStateSnapshot,
  TSharkord,
};

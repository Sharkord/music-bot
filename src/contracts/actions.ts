type PlayerQueueEntry = {
  position: number;
  label: string;
};

type PlayerStateSnapshot = {
  currentSong: string | null;
  currentThumbnailUrl: string | null;
  streamActive: boolean;
  streamStarting: boolean;
  playbackStartedAtEpochMs: number | null;
  currentTrackDurationSeconds: number | null;
  currentTrackEndsAtEpochMs: number | null;
  queue: PlayerQueueEntry[];
  queueText: string;
};

type PlayerActionResponse = {
  message: string;
  player: PlayerStateSnapshot;
};

type Actions = {
  getPlayerState: {
    payload: void;
    response: PlayerStateSnapshot;
  };
  cleanChannel: {
    payload: void;
    response: PlayerActionResponse;
  };
  playMusic: {
    payload: { query: string };
    response: PlayerActionResponse;
  };
  queueMusic: {
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
  getControlPermissions: {
    payload: void;
    response: {
      roleId: number;
      hideButtonWhenNoPermission: boolean;
    };
  };
};

export type {
  Actions,
  PlayerActionResponse,
  PlayerQueueEntry,
  PlayerStateSnapshot,
};

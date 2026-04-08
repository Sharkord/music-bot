import type { PlayerStateSnapshot } from "../../contracts/actions";

const EMPTY_PLAYER_STATE: PlayerStateSnapshot = {
  currentSong: null,
  currentThumbnailUrl: null,
  streamActive: false,
  streamStarting: false,
  playbackStartedAtEpochMs: null,
  currentTrackDurationSeconds: null,
  currentTrackEndsAtEpochMs: null,
  queue: [],
  queueText: "Queue is empty.",
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong.";
};

const formatDuration = (totalSeconds: number | null): string => {
  if (totalSeconds === null || !Number.isFinite(totalSeconds)) {
    return "--:--";
  }

  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const getPlaybackProgress = (playerState: PlayerStateSnapshot) => {
  const elapsedSeconds =
    playerState.streamActive && playerState.playbackStartedAtEpochMs !== null
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - playerState.playbackStartedAtEpochMs) / 1000,
          ),
        )
      : null;
  const clampedElapsedSeconds =
    elapsedSeconds !== null && playerState.currentTrackDurationSeconds !== null
      ? Math.min(elapsedSeconds, playerState.currentTrackDurationSeconds)
      : elapsedSeconds;
  const progressPercent =
    clampedElapsedSeconds !== null &&
    playerState.currentTrackDurationSeconds !== null &&
    playerState.currentTrackDurationSeconds > 0
      ? Math.min(
          100,
          (clampedElapsedSeconds / playerState.currentTrackDurationSeconds) *
            100,
        )
      : 0;

  return {
    clampedElapsedSeconds,
    progressPercent,
  };
};

export {
  EMPTY_PLAYER_STATE,
  formatDuration,
  getErrorMessage,
  getPlaybackProgress,
};

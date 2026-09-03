import { useCanUseAction, usePush } from "@sharkord/plugin-sdk/client";
import { useCallback, useEffect, useState } from "react";
import type { PlayerStateSnapshot, TSharkord } from "../contract";
import { callAction, useCurrentVoiceChannelId } from "./store";

const EMPTY_PLAYER_STATE: PlayerStateSnapshot = {
  currentSong: null,
  currentInvokerUserId: null,
  currentThumbnailUrl: null,
  streamActive: false,
  streamStarting: false,
  playbackStartedAtEpochMs: null,
  currentTrackDurationSeconds: null,
  volume: 50,
  queue: [],
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message
    ? error.message
    : "Something went wrong.";

const formatDuration = (totalSeconds: number | null): string => {
  if (totalSeconds === null || !Number.isFinite(totalSeconds)) return "--:--";

  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const useElapsedSeconds = (player: PlayerStateSnapshot): number | null => {
  const startedAt = player.playbackStartedAtEpochMs;
  const isPlaying = player.streamActive && startedAt !== null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isPlaying) return;

    setNow(Date.now());

    const interval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, [isPlaying, startedAt]);

  if (!isPlaying || startedAt === null) return null;

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));

  return player.currentTrackDurationSeconds === null
    ? elapsed
    : Math.min(elapsed, player.currentTrackDurationSeconds);
};

const usePlayer = () => {
  const currentVoiceChannelId = useCurrentVoiceChannelId();
  // the server checks again on every call; this only keeps the UI honest
  const can = {
    play: useCanUseAction<TSharkord>("playMusic"),
    skip: useCanUseAction<TSharkord>("nextMusic"),
    stop: useCanUseAction<TSharkord>("stopMusic"),
    volume: useCanUseAction<TSharkord>("setVolume"),
    jump: useCanUseAction<TSharkord>("jumpToQueueItem"),
    remove: useCanUseAction<TSharkord>("removeQueueItem"),
  };
  const [player, setPlayer] = useState(EMPTY_PLAYER_STATE);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  // the server pushes on every change, so nothing here polls
  usePush<TSharkord>(({ channelId, player: pushedPlayer }) => {
    if (channelId !== currentVoiceChannelId) return;

    setPlayer(pushedPlayer);
  });

  useEffect(() => {
    setError("");

    if (!currentVoiceChannelId) {
      setPlayer(EMPTY_PLAYER_STATE);

      return;
    }

    let cancelled = false;

    callAction("getPlayerState")
      .then((state) => {
        if (!cancelled) setPlayer(state);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currentVoiceChannelId]);

  const run = useCallback(
    async (
      call: () => Promise<{ message: string; player: PlayerStateSnapshot }>,
    ) => {
      setIsBusy(true);

      try {
        const response = await call();

        setPlayer(response.player);
        // the panel already shows what changed, so only failures are worth text
        setError("");
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsBusy(false);
      }
    },
    [],
  );

  const elapsedSeconds = useElapsedSeconds(player);
  const duration = player.currentTrackDurationSeconds;
  const progressPercent =
    elapsedSeconds !== null && duration !== null && duration > 0
      ? Math.min(100, (elapsedSeconds / duration) * 100)
      : 0;

  return {
    can,
    elapsedSeconds,
    error,
    isBusy,
    isDisconnected: !currentVoiceChannelId,
    play: (query: string) => run(() => callAction("playMusic", { query })),
    player,
    progressPercent,
    remove: (position: number) =>
      run(() => callAction("removeQueueItem", { position })),
    jumpTo: (position: number) =>
      run(() => callAction("jumpToQueueItem", { position })),
    skip: () => run(() => callAction("nextMusic")),
    stop: () => run(() => callAction("stopMusic")),
    setVolume: (volume: number) => run(() => callAction("setVolume", { volume })),
  };
};

export { formatDuration, usePlayer };

import { useEffect, useRef, useState } from "react";
import type { PlayerStateSnapshot } from "../../contracts/actions";
import { useCallAction, useCurrentVoiceChannelId } from "../store/hooks";
import {
  EMPTY_PLAYER_STATE,
  getErrorMessage,
  getPlaybackProgress,
} from "./player-utils";

type PendingAction =
  | "clean"
  | "play"
  | "queue"
  | "stop"
  | "remove"
  | "next"
  | "jump"
  | null;

const usePlayerController = (open: boolean) => {
  const callAction = useCallAction();
  const currentVoiceChannelId = useCurrentVoiceChannelId();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [playerState, setPlayerState] =
    useState<PlayerStateSnapshot>(EMPTY_PLAYER_STATE);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const refreshInFlightRef = useRef(false);

  const refreshPlayerState = async (showErrors = false) => {
    if (!currentVoiceChannelId) {
      setPlayerState(EMPTY_PLAYER_STATE);
      return;
    }

    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    setIsRefreshing(true);

    try {
      const nextState = await callAction("getPlayerState");

      setPlayerState(nextState);
    } catch (error) {
      if (showErrors) {
        setMessage(getErrorMessage(error));
      }
    } finally {
      refreshInFlightRef.current = false;
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    refreshPlayerState();
  }, [open, currentVoiceChannelId]);

  useEffect(() => {
    if (!open || !currentVoiceChannelId) {
      return;
    }

    const interval = window.setInterval(() => {
      refreshPlayerState();
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [open, currentVoiceChannelId]);

  useEffect(() => {
    if (currentVoiceChannelId) {
      return;
    }

    setPlayerState(EMPTY_PLAYER_STATE);
  }, [currentVoiceChannelId]);

  const runAction = async (
    action: Exclude<PendingAction, null>,
    callback: () => Promise<
      PlayerStateSnapshot | { message: string; player: PlayerStateSnapshot }
    >,
  ) => {
    setPendingAction(action);

    try {
      const response = await callback();

      if ("player" in response) {
        setPlayerState(response.player);
        setMessage(response.message);
        return;
      }

      setPlayerState(response);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  };

  const handlePlay = async () => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setMessage("Enter a YouTube URL, search query, or direct audio URL.");
      return;
    }

    await runAction("play", () =>
      callAction("playMusic", { query: trimmedQuery }),
    );
    setQuery("");
  };

  const handleQueue = async () => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setMessage("Enter a YouTube URL, search query, or direct audio URL.");
      return;
    }

    await runAction("queue", () =>
      callAction("queueMusic", { query: trimmedQuery }),
    );
    setQuery("");
  };

  const handleStop = async () => {
    await runAction("stop", () => callAction("stopMusic"));
  };

  const handleClean = async () => {
    await runAction("clean", () => callAction("cleanChannel"));
  };

  const handleRemoveQueueItem = async (position: number) => {
    await runAction("remove", () =>
      callAction("removeQueueItem", { position }),
    );
  };

  const handleNextTrack = async () => {
    await runAction("next", () => callAction("nextMusic"));
  };

  const handleJumpToQueueItem = async (position: number) => {
    await runAction("jump", () => callAction("jumpToQueueItem", { position }));
  };

  const isBusy = pendingAction !== null;
  const isDisconnected = !currentVoiceChannelId;
  const playback = getPlaybackProgress(playerState);

  return {
    currentVoiceChannelId,
    handleClean,
    handleJumpToQueueItem,
    handleNextTrack,
    handlePlay,
    handleQueue,
    handleRemoveQueueItem,
    handleStop,
    isBusy,
    isDisconnected,
    isRefreshing,
    message,
    playerState,
    playback,
    query,
    refreshPlayerState,
    setQuery,
  };
};

export { usePlayerController };

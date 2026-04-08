import { memo, useState } from "react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@sharkord/ui";
import { PlayerControls } from "./player-controls";
import { PlayerCurrentTrack } from "./player-current-track";
import { PlayerQueue } from "./player-queue";
import {
  messageStyle,
  panelBodyStyle,
  panelStyle,
  queueSectionBodyStyle,
  sectionHeaderStyle,
  sectionTitleStyle,
  statusMetaStyle,
  subtitleStyle,
  titleGroupStyle,
} from "./styles";
import { formatDuration } from "./player-utils";
import { usePlayerController } from "./use-player-controller";
import { PlayerIcon } from "./icons";

type TPlayerProps = {
  canControl: boolean;
};

const Player = memo(({ canControl }: TPlayerProps) => {
  const [open, setOpen] = useState(false);
  const {
    handleClean,
    handleJumpToQueueItem,
    handleNextTrack,
    handlePlay,
    handleQueue,
    handleRemoveQueueItem,
    handleStop,
    isBusy,
    isDisconnected,
    message,
    playerState,
    playback,
    query,
    setQuery,
  } = usePlayerController(open);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <PlayerIcon />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" style={panelStyle}>
        <div style={panelBodyStyle}>
          <div>
            <div style={sectionHeaderStyle}>
              <div style={titleGroupStyle}>
                <div style={sectionTitleStyle}>Music Player</div>
                <div style={subtitleStyle}>
                  Search, queue, skip, and manage playback for the current voice
                  channel.
                </div>
              </div>
              <div style={statusMetaStyle}>
                Playback: {formatDuration(playback.clampedElapsedSeconds)} /{" "}
                {formatDuration(playerState.currentTrackDurationSeconds)}
              </div>
            </div>

            <PlayerControls
              canClean={true}
              canSkip={playerState.queue.length > 0}
              canStop={playerState.streamActive}
              canControl={canControl}
              isBusy={isBusy}
              isDisconnected={isDisconnected}
              onClean={handleClean}
              onNextTrack={handleNextTrack}
              onPlay={handlePlay}
              onQueue={handleQueue}
              onStop={handleStop}
              query={query}
              setQuery={setQuery}
            />
          </div>

          <div style={messageStyle}>{message}</div>

          <div style={queueSectionBodyStyle}>
            {playerState.streamActive ? (
              <PlayerCurrentTrack
                currentSong={playerState.currentSong}
                thumbnailUrl={playerState.currentThumbnailUrl}
                durationSeconds={playerState.currentTrackDurationSeconds}
                elapsedSeconds={playback.clampedElapsedSeconds}
                progressPercent={playback.progressPercent}
              />
            ) : null}

            {playerState.queue.length > 0 ? (
              <PlayerQueue
                isBusy={isBusy}
                isDisconnected={isDisconnected}
                onJumpToQueueItem={handleJumpToQueueItem}
                onRemoveQueueItem={handleRemoveQueueItem}
                queue={playerState.queue}
                queueText={playerState.queueText}
                canControl={canControl}
              />
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

export { Player };

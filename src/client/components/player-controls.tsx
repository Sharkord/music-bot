import { Button, Input } from "@sharkord/ui";
import { buttonRowStyle, controlsRowStyle, searchRowStyle } from "./styles";

type PlayerControlsProps = {
  canClean: boolean;
  canStop: boolean;
  canSkip: boolean;
  isBusy: boolean;
  isDisconnected: boolean;
  onClean: () => Promise<void>;
  onNextTrack: () => Promise<void>;
  onPlay: () => Promise<void>;
  onQueue: () => Promise<void>;
  onStop: () => Promise<void>;
  query: string;
  setQuery: (value: string) => void;
  canControl: boolean;
};

const PlayerControls = ({
  canClean,
  canSkip,
  canStop,
  isBusy,
  isDisconnected,
  onClean,
  onNextTrack,
  onPlay,
  onQueue,
  onStop,
  query,
  setQuery,
  canControl,
}: PlayerControlsProps) => (
  <div style={controlsRowStyle}>
    <div style={searchRowStyle}>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onEnter={onPlay}
        placeholder="Paste a URL or search for a song"
        disabled={isBusy || isDisconnected || !canControl}
      />

      <Button
        onClick={onPlay}
        disabled={
          isDisconnected || isBusy || query.trim() === "" || !canControl
        }
      >
        Play
      </Button>
    </div>

    <div style={buttonRowStyle}>
      <Button
        variant="outline"
        onClick={onQueue}
        disabled={
          isDisconnected || isBusy || query.trim() === "" || !canControl
        }
      >
        Add to Queue
      </Button>

      <Button
        variant="secondary"
        onClick={onNextTrack}
        disabled={isDisconnected || isBusy || !canSkip || !canControl}
      >
        Next
      </Button>

      <Button
        variant="outline"
        onClick={onClean}
        disabled={isDisconnected || isBusy || !canClean || !canControl}
      >
        Clean
      </Button>

      <Button
        variant="destructive"
        onClick={onStop}
        disabled={isDisconnected || isBusy || !canStop || !canControl}
      >
        Stop
      </Button>
    </div>
  </div>
);

export { PlayerControls };

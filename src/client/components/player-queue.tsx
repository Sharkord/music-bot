import { Button, IconButton, Separator } from "@sharkord/ui";
import type { PlayerQueueEntry } from "../../contracts/actions";
import {
  emptyStateStyle,
  helperTextStyle,
  queueItemActionStyle,
  queueItemIndexStyle,
  queueItemLabelStyle,
  queueItemStyle,
  queueListStyle,
  sectionHeaderStyle,
  sectionStyle,
  sectionTitleStyle,
} from "./styles";
import { PlayIcon, XIcon } from "./icons";

type PlayerQueueProps = {
  isBusy: boolean;
  isDisconnected: boolean;
  onJumpToQueueItem: (position: number) => Promise<void>;
  onRemoveQueueItem: (position: number) => Promise<void>;
  queue: PlayerQueueEntry[];
  queueText: string;
  canControl: boolean;
};

const PlayerQueue = ({
  isBusy,
  isDisconnected,
  onJumpToQueueItem,
  onRemoveQueueItem,
  queue,
  queueText,
  canControl,
}: PlayerQueueProps) => (
  <div style={sectionStyle}>
    <div style={sectionHeaderStyle}>
      <div style={sectionTitleStyle}>Up Next</div>
      <div style={helperTextStyle}>
        {queue.length === 0 ? "No queued tracks" : `${queue.length} queued`}
      </div>
    </div>

    <Separator style={{ margin: "12px 0" }} />

    {queue.length === 0 ? (
      <div style={emptyStateStyle}>{queueText}</div>
    ) : (
      <ol style={queueListStyle}>
        {queue.map((item) => (
          <li key={`${item.position}-${item.label}`} style={queueItemStyle}>
            <span style={queueItemIndexStyle}>{item.position}.</span>
            <span style={queueItemLabelStyle}>{item.label}</span>
            <IconButton
              icon={PlayIcon}
              variant="ghost"
              size="sm"
              onClick={() => onJumpToQueueItem(item.position)}
              disabled={isDisconnected || isBusy || !canControl}
            />
            <IconButton
              icon={XIcon}
              variant="ghost"
              size="sm"
              onClick={() => onRemoveQueueItem(item.position)}
              disabled={isDisconnected || isBusy || !canControl}
            />
          </li>
        ))}
      </ol>
    )}
  </div>
);

export { PlayerQueue };

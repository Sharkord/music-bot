import { Button, IconButton, Separator } from "@sharkord/ui";
import type { PlayerQueueEntry } from "../../contracts/actions";
import {
  emptyStateStyle,
  helperTextStyle,
  queueItemIndexStyle,
  queueItemLabelStyle,
  queueItemMetaStyle,
  queueItemStyle,
  queueListStyle,
  sectionHeaderStyle,
  sectionStyle,
  sectionTitleStyle,
} from "./styles";
import { PlayIcon, XIcon } from "./icons";
import { useUserById } from "../store/hooks";

type PlayerQueueProps = {
  isBusy: boolean;
  isDisconnected: boolean;
  onJumpToQueueItem: (position: number) => Promise<void>;
  onRemoveQueueItem: (position: number) => Promise<void>;
  queue: PlayerQueueEntry[];
  queueText: string;
  canControl: boolean;
};

type QueueItemProps = {
  isBusy: boolean;
  isDisconnected: boolean;
  canControl: boolean;
  item: PlayerQueueEntry;
  onJumpToQueueItem: (position: number) => Promise<void>;
  onRemoveQueueItem: (position: number) => Promise<void>;
};

const QueueItem = ({
  isBusy,
  isDisconnected,
  canControl,
  item,
  onJumpToQueueItem,
  onRemoveQueueItem,
}: QueueItemProps) => {
  const invoker = useUserById(item.invokerUserId);

  return (
    <li key={`${item.position}-${item.label}`} style={queueItemStyle}>
      <span style={queueItemIndexStyle}>{item.position}.</span>
      <div style={queueItemLabelStyle}>
        <div>{item.label}</div>
        <div style={queueItemMetaStyle}>Added by {invoker?.name}</div>
      </div>
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
  );
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
          <QueueItem
            key={`${item.position}-${item.label}`}
            canControl={canControl}
            isBusy={isBusy}
            isDisconnected={isDisconnected}
            item={item}
            onJumpToQueueItem={onJumpToQueueItem}
            onRemoveQueueItem={onRemoveQueueItem}
          />
        ))}
      </ol>
    )}
  </div>
);

export { PlayerQueue };

import {
  currentTrackArtworkFallbackStyle,
  currentTrackArtworkImageStyle,
  currentTrackArtworkStyle,
  currentTrackCardStyle,
  currentTrackContentStyle,
  currentTrackInvokerStyle,
  currentTrackLabelStyle,
  currentTrackLayoutStyle,
  currentTrackTitleStyle,
  progressFillStyle,
  progressTimesStyle,
  progressTrackStyle,
} from "./styles";
import { formatDuration } from "./player-utils";
import { useUserById } from "../store/hooks";

type PlayerCurrentTrackProps = {
  currentSong: string | null;
  currentInvokerUserId: number | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  elapsedSeconds: number | null;
  progressPercent: number;
};

const PlayerCurrentTrack = ({
  currentSong,
  currentInvokerUserId,
  thumbnailUrl,
  durationSeconds,
  elapsedSeconds,
  progressPercent,
}: PlayerCurrentTrackProps) => {
  const invoker = useUserById(currentInvokerUserId ?? -1);

  return (
    <div style={currentTrackCardStyle}>
      <div style={currentTrackLayoutStyle}>
        <div style={currentTrackArtworkStyle}>
          {thumbnailUrl ? (
            <img
              alt="Current track artwork"
              src={thumbnailUrl}
              style={currentTrackArtworkImageStyle}
            />
          ) : (
            <div style={currentTrackArtworkFallbackStyle}>♪</div>
          )}
        </div>

        <div style={currentTrackContentStyle}>
          <div style={currentTrackLabelStyle}>Now Playing</div>

          <div style={currentTrackTitleStyle}>{currentSong}</div>
          <div style={currentTrackInvokerStyle}>Added by {invoker?.name}</div>
        </div>
      </div>

      <div style={progressTrackStyle}>
        <div
          style={{
            ...progressFillStyle,
            width: `${progressPercent}%`,
          }}
        />
      </div>

      <div style={progressTimesStyle}>
        <span>{formatDuration(elapsedSeconds)}</span>
        <span>{formatDuration(durationSeconds)}</span>
      </div>
    </div>
  );
};

export { PlayerCurrentTrack };

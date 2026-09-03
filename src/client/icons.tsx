type IconProps = {
  size?: number;
};

const NoteIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 3.5v11.2a3.3 3.3 0 1 1-2-3V7.9l-8 1.6v7.2a3.3 3.3 0 1 1-2-3V6.3l12-2.8z" />
  </svg>
);

const SearchIcon = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.3 4.3-1.4 1.4-4.3-4.3A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" />
  </svg>
);

const PlayIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4.8c0-.8.9-1.3 1.6-.9l10.4 6.3c.6.4.6 1.3 0 1.7L8.6 18.2c-.7.4-1.6-.1-1.6-.9V4.8z" />
  </svg>
);

const StopIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
);

const SkipIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 5.4c0-.7.8-1.1 1.4-.7l8.2 5.6c.5.4.5 1.1 0 1.5l-8.2 5.6c-.6.4-1.4 0-1.4-.7V5.4z" />
    <rect x="16.5" y="5" width="2.5" height="14" rx="1.2" />
  </svg>
);

const VolumeIcon = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.3 3.9c.6-.5 1.5 0 1.5.8v14.6c0 .8-.9 1.3-1.5.8L6.6 16H3.8c-.7 0-1.3-.6-1.3-1.3V9.3C2.5 8.6 3.1 8 3.8 8h2.8l4.7-4.1z" />
    <path d="M16.2 8.3a1 1 0 0 1 1.4 0 5.2 5.2 0 0 1 0 7.4 1 1 0 1 1-1.4-1.4 3.2 3.2 0 0 0 0-4.6 1 1 0 0 1 0-1.4z" />
  </svg>
);

const MuteIcon = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.3 3.9c.6-.5 1.5 0 1.5.8v14.6c0 .8-.9 1.3-1.5.8L6.6 16H3.8c-.7 0-1.3-.6-1.3-1.3V9.3C2.5 8.6 3.1 8 3.8 8h2.8l4.7-4.1z" />
    <path d="m17.4 10.6 1.9-1.9 1.2 1.2-1.9 1.9 1.9 1.9-1.2 1.2-1.9-1.9-1.9 1.9-1.2-1.2 1.9-1.9-1.9-1.9 1.2-1.2z" />
  </svg>
);

const CloseIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.2 4.8 12 10.6l5.8-5.8 1.4 1.4L13.4 12l5.8 5.8-1.4 1.4L12 13.4l-5.8 5.8-1.4-1.4L10.6 12 4.8 6.2z" />
  </svg>
);

export {
  CloseIcon,
  MuteIcon,
  NoteIcon,
  PlayIcon,
  SearchIcon,
  SkipIcon,
  StopIcon,
  VolumeIcon,
};

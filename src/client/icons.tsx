import type { ReactNode } from "react";

type IconProps = {
  size?: number;
};

type LucideIconProps = IconProps & {
  children: ReactNode;
  /** lucide draws in strokes; the transport buttons want solid shapes */
  fill?: string;
};

const Icon = ({ size = 16, fill = "none", children }: LucideIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/** lucide: music */
const NoteIcon = ({ size = 20 }: IconProps) => (
  <Icon size={size}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </Icon>
);

/** lucide: search */
const SearchIcon = ({ size = 16 }: IconProps) => (
  <Icon size={size}>
    <path d="m21 21-4.34-4.34" />
    <circle cx="11" cy="11" r="8" />
  </Icon>
);

/** lucide: play */
const PlayIcon = ({ size = 20 }: IconProps) => (
  <Icon size={size} fill="currentColor">
    <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
  </Icon>
);

/** lucide: square */
const StopIcon = ({ size = 18 }: IconProps) => (
  <Icon size={size} fill="currentColor">
    <rect width="18" height="18" x="3" y="3" rx="2" />
  </Icon>
);

/** lucide: skip-forward */
const SkipIcon = ({ size = 18 }: IconProps) => (
  <Icon size={size} fill="currentColor">
    <path d="M21 4v16" />
    <path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" />
  </Icon>
);

/** lucide: volume-2 */
const VolumeIcon = ({ size = 16 }: IconProps) => (
  <Icon size={size}>
    <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
    <path d="M16 9a5 5 0 0 1 0 6" />
    <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
  </Icon>
);

/** lucide: volume-off */
const MuteIcon = ({ size = 16 }: IconProps) => (
  <Icon size={size}>
    <path d="M16 9a5 5 0 0 1 .95 2.293" />
    <path d="M19.364 5.636a9 9 0 0 1 1.889 9.96" />
    <path d="m2 2 20 20" />
    <path d="m7 7-.587.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298V11" />
    <path d="M9.828 4.172A.686.686 0 0 1 11 4.657v.686" />
  </Icon>
);

/** lucide: x */
const CloseIcon = ({ size = 14 }: IconProps) => (
  <Icon size={size}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
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

import type { CSSProperties } from "react";

const panelStyle: CSSProperties = {
  width: "min(720px, calc(100vw - 20px))",
  maxWidth: "none",
  padding: 14,
  overflow: "hidden",
  display: "grid",
  gap: 12,
};

const panelBodyStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto 1fr",
  gap: 10,
  height: "100%",
};

const controlsRowStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const searchRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 8,
  alignItems: "center",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const sectionStyle: CSSProperties = {
  border: "1px solid color-mix(in srgb, currentColor 12%, transparent)",
  borderRadius: 12,
  padding: 10,
  minHeight: 0,
  overflow: "hidden",
  background: "color-mix(in srgb, currentColor 3%, transparent)",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 8,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const titleGroupStyle: CSSProperties = {
  display: "grid",
  gap: 2,
};

const subtitleStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.3,
  opacity: 0.72,
};

const currentTrackCardStyle: CSSProperties = {
  border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
  borderRadius: 12,
  padding: 10,
  display: "grid",
  gap: 8,
  background:
    "linear-gradient(180deg, color-mix(in srgb, currentColor 5%, transparent), transparent)",
};

const currentTrackLayoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "68px 1fr",
  gap: 10,
  alignItems: "center",
  minWidth: 0,
};

const currentTrackArtworkStyle: CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: 12,
  overflow: "hidden",
  background:
    "linear-gradient(135deg, color-mix(in srgb, currentColor 12%, transparent), color-mix(in srgb, currentColor 4%, transparent))",
  border: "1px solid color-mix(in srgb, currentColor 12%, transparent)",
  boxShadow: "0 10px 24px color-mix(in srgb, black 14%, transparent)",
};

const currentTrackArtworkImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const currentTrackArtworkFallbackStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  fontSize: 24,
  opacity: 0.7,
};

const currentTrackContentStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const currentTrackLabelStyle: CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  opacity: 0.62,
};

const currentTrackTitleStyle: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 700,
  minWidth: 0,
  overflowWrap: "anywhere",
};

const currentTrackInvokerStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.3,
  opacity: 0.74,
};

const progressTrackStyle: CSSProperties = {
  position: "relative",
  height: 7,
  borderRadius: 999,
  overflow: "hidden",
  background: "color-mix(in srgb, currentColor 12%, transparent)",
};

const progressFillStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "0%",
  borderRadius: 999,
  background: "currentColor",
  opacity: 0.82,
};

const progressTimesStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 11,
  lineHeight: 1.3,
  opacity: 0.72,
};

const statusTextStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.35,
};

const statusMetaStyle: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.3,
  opacity: 0.78,
  marginTop: 2,
};

const helperTextStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.7,
};

const messageStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.3,
  minHeight: 14,
};

const queueListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 6,
  maxHeight: "100%",
  overflowY: "auto",
};

const queueItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto auto",
  gap: 8,
  alignItems: "center",
  fontSize: 12,
  lineHeight: 1.3,
  padding: "7px 8px",
  borderRadius: 10,
  background: "color-mix(in srgb, currentColor 4%, transparent)",
};

const queueItemIndexStyle: CSSProperties = {
  width: 16,
  opacity: 0.65,
};

const queueItemLabelStyle: CSSProperties = {
  minWidth: 0,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
};

const queueItemMetaStyle: CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  lineHeight: 1.25,
  opacity: 0.68,
};

const queueSectionBodyStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto 1fr",
  gap: 8,
  minHeight: 0,
};

const queueItemActionStyle: CSSProperties = {
  minWidth: 28,
};

const emptyStateStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.35,
  opacity: 0.72,
};

export {
  buttonRowStyle,
  controlsRowStyle,
  currentTrackArtworkFallbackStyle,
  currentTrackArtworkImageStyle,
  currentTrackArtworkStyle,
  currentTrackCardStyle,
  currentTrackContentStyle,
  currentTrackLabelStyle,
  currentTrackLayoutStyle,
  currentTrackTitleStyle,
  currentTrackInvokerStyle,
  emptyStateStyle,
  helperTextStyle,
  messageStyle,
  panelBodyStyle,
  panelStyle,
  progressFillStyle,
  progressTimesStyle,
  progressTrackStyle,
  queueItemActionStyle,
  queueItemIndexStyle,
  queueItemLabelStyle,
  queueItemMetaStyle,
  queueItemStyle,
  queueListStyle,
  queueSectionBodyStyle,
  searchRowStyle,
  sectionHeaderStyle,
  sectionStyle,
  sectionTitleStyle,
  statusMetaStyle,
  statusTextStyle,
  subtitleStyle,
  titleGroupStyle,
};

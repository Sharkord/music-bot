import type { CSSProperties } from "react";

const ACCENT = "#1ed760";

const CSS = `
.mb-panel { color: #fff; font-size: 13px; }
.mb-panel *, .mb-panel *::before, .mb-panel *::after { box-sizing: border-box; }

.mb-search { display: flex; align-items: center; gap: 8px; padding: 12px; }
.mb-search-field {
  flex: 1; display: flex; align-items: center; gap: 10px; height: 38px;
  padding: 0 14px; border-radius: 999px; background: #242424;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}
.mb-search-field:focus-within { background: #2a2a2a; box-shadow: inset 0 0 0 1px #4d4d4d; }
.mb-search-field svg { color: #a7a7a7; flex: none; }
.mb-search-input {
  flex: 1; min-width: 0; border: 0; outline: 0; background: transparent;
  color: #fff; font: inherit;
}
.mb-search-input::placeholder { color: #a7a7a7; }
.mb-search-input:disabled { cursor: not-allowed; }

.mb-add {
  flex: none; height: 38px; padding: 0 18px; border: 0; border-radius: 999px;
  background: ${ACCENT}; color: #000; font: inherit; font-weight: 700;
  letter-spacing: 0.02em; cursor: pointer;
  transition: transform 0.1s ease, background 0.15s ease;
}
.mb-add:hover:not(:disabled) { background: #24e065; transform: scale(1.04); }
.mb-add:disabled { opacity: 0.4; cursor: not-allowed; }

.mb-hero {
  display: grid; grid-template-columns: 88px 1fr; gap: 14px;
  align-items: center; padding: 4px 16px 12px;
}
.mb-art {
  width: 88px; height: 88px; border-radius: 8px; overflow: hidden;
  display: grid; place-items: center; background: #282828;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.mb-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mb-art-fallback { color: #6a6a6a; }

.mb-eyebrow {
  font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: ${ACCENT};
}
.mb-eyebrow-idle { color: #a7a7a7; }
.mb-title {
  margin-top: 5px; font-size: 16px; font-weight: 700; line-height: 1.25;
  overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.mb-sub { margin-top: 3px; font-size: 12px; color: #b3b3b3; }

.mb-progress { padding: 0 16px; }
.mb-bar { height: 4px; border-radius: 999px; background: #4d4d4d; overflow: hidden; }
.mb-bar-fill {
  height: 100%; width: 0; border-radius: 999px; background: #fff;
  transition: width 1s linear, background 0.15s ease;
}
.mb-panel:hover .mb-bar-fill { background: ${ACCENT}; }
.mb-times {
  display: flex; justify-content: space-between; margin-top: 6px;
  font-size: 11px; color: #a7a7a7; font-variant-numeric: tabular-nums;
}

.mb-controls {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  padding: 12px 16px 16px;
}
.mb-transport {
  grid-column: 2; display: flex; align-items: center; gap: 24px;
}
.mb-ctrl {
  display: grid; place-items: center; padding: 4px; border: 0;
  background: transparent; color: #b3b3b3; cursor: pointer;
  transition: color 0.15s ease, transform 0.1s ease;
}
.mb-ctrl:hover:not(:disabled) { color: #fff; transform: scale(1.1); }
.mb-ctrl:disabled { opacity: 0.35; cursor: not-allowed; }
.mb-ctrl-main {
  width: 48px; height: 48px; padding: 0; border-radius: 50%;
  background: #fff; color: #000;
}
.mb-ctrl-main:hover:not(:disabled) { color: #000; transform: scale(1.06); }
.mb-ctrl-main:disabled { background: #535353; color: #1a1a1a; }

.mb-volume {
  grid-column: 3; justify-self: end; display: flex; align-items: center; gap: 6px;
}
.mb-volume svg { color: #b3b3b3; flex: none; }
.mb-volume:hover svg { color: #fff; }
.mb-volume-input {
  width: 72px; height: 12px; margin: 0; padding: 0;
  background: transparent; appearance: none; -webkit-appearance: none;
  cursor: pointer;
}
.mb-volume-input:disabled { cursor: not-allowed; opacity: 0.4; }
.mb-volume-input::-webkit-slider-runnable-track {
  height: 4px; border-radius: 999px;
  background: linear-gradient(
    to right, #fff 0 var(--mb-volume), #4d4d4d var(--mb-volume) 100%
  );
}
.mb-volume-input::-moz-range-track { height: 4px; border-radius: 999px; background: #4d4d4d; }
.mb-volume-input::-moz-range-progress { height: 4px; border-radius: 999px; background: #fff; }
.mb-volume:hover .mb-volume-input::-webkit-slider-runnable-track {
  background: linear-gradient(
    to right, ${ACCENT} 0 var(--mb-volume), #4d4d4d var(--mb-volume) 100%
  );
}
.mb-volume:hover .mb-volume-input::-moz-range-progress { background: ${ACCENT}; }
.mb-volume-input::-webkit-slider-thumb {
  appearance: none; -webkit-appearance: none; width: 12px; height: 12px;
  margin-top: -4px; border: 0; border-radius: 50%; background: #fff;
  opacity: 0; transition: opacity 0.15s ease;
}
.mb-volume-input::-moz-range-thumb {
  width: 12px; height: 12px; border: 0; border-radius: 50%; background: #fff;
  opacity: 0; transition: opacity 0.15s ease;
}
.mb-volume:hover .mb-volume-input::-webkit-slider-thumb,
.mb-volume-input:focus-visible::-webkit-slider-thumb { opacity: 1; }
.mb-volume:hover .mb-volume-input::-moz-range-thumb,
.mb-volume-input:focus-visible::-moz-range-thumb { opacity: 1; }

.mb-section { border-top: 1px solid #242424; padding: 12px 8px 10px; }
.mb-section-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px; padding: 0 8px 8px;
}
.mb-section-title {
  font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: #b3b3b3;
}
.mb-section-count { font-size: 11px; color: #a7a7a7; }

.mb-list { list-style: none; margin: 0; padding: 0; max-height: 216px; overflow-y: auto; }
.mb-list::-webkit-scrollbar { width: 8px; }
.mb-list::-webkit-scrollbar-track { background: transparent; }
.mb-list::-webkit-scrollbar-thumb { background: #4d4d4d; border-radius: 4px; }
.mb-list::-webkit-scrollbar-thumb:hover { background: #6a6a6a; }

.mb-row {
  display: grid; grid-template-columns: 24px 1fr auto; gap: 10px;
  align-items: center; padding: 7px 8px; border-radius: 6px;
  transition: background 0.15s ease;
}
.mb-row:hover, .mb-row:focus-within { background: #1f1f1f; }
.mb-row-lead { display: grid; place-items: center; height: 20px; }
.mb-row-num { font-size: 12px; color: #a7a7a7; font-variant-numeric: tabular-nums; }
.mb-row:hover .mb-row-num, .mb-row:focus-within .mb-row-num { display: none; }
.mb-row-play { display: none; }
.mb-row:hover .mb-row-play, .mb-row:focus-within .mb-row-play { display: grid; }
.mb-row-label {
  min-width: 0; font-size: 13px; line-height: 1.3; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.mb-row-meta { margin-top: 2px; font-size: 11px; color: #a7a7a7; }
.mb-row-remove { opacity: 0; transition: opacity 0.15s ease, color 0.15s ease; }
.mb-row:hover .mb-row-remove, .mb-row:focus-within .mb-row-remove { opacity: 1; }
.mb-row-remove:focus-visible { opacity: 1; }

.mb-note { padding: 0 16px 12px; font-size: 12px; color: #f5a3a3; overflow-wrap: anywhere; }
.mb-empty { padding: 6px 16px 14px; font-size: 12px; color: #a7a7a7; text-align: center; }

/* the pulse on the topbar trigger, outside .mb-panel */
.mb-dot {
  position: absolute; right: 6px; top: 6px; width: 7px; height: 7px;
  border-radius: 50%; background: ${ACCENT};
  animation: mb-pulse 1.8s ease-in-out infinite;
}
@keyframes mb-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

@media (prefers-reduced-motion: reduce) {
  .mb-dot, .mb-panel *, .mb-panel *::before, .mb-panel *::after {
    animation-duration: 0.01ms !important; transition-duration: 0.01ms !important;
  }
}
`;

const STYLE_ID = "music-bot-player-styles";

if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const element = document.createElement("style");

  element.id = STYLE_ID;
  element.textContent = CSS;

  document.head.append(element);
}

const panelStyle: CSSProperties = {
  width: "min(380px, calc(100vw - 20px))",
  padding: 0,
  border: "1px solid #2a2a2a",
  borderRadius: 14,
  background: "linear-gradient(180deg, #1c2a20 0%, #141414 38%, #121212 100%)",
  overflow: "hidden",
};

export { ACCENT, panelStyle };

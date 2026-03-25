import path from "path";
import { getFfmpegBinaryPath } from "./paths";
import { fetchYouTubeAudio, isYouTubeUrl } from "./yt-dlp";

type TMusicStreamResult = {
  process: ReturnType<typeof Bun.spawn>;
  title: string;
};

type TMusicOptions = {
  sourceUrl: string;
  audioPayloadType: number;
  audioSsrc: number;
  rtpHost: string;
  audioRtpPort: number;

  volume?: number; // 0-100, default 100
  bitrate?: string;
  log: (...messages: unknown[]) => void;
  error: (...messages: unknown[]) => void;
  debug: (...messages: unknown[]) => void;
  onEnd?: () => void;
};

const spawnMusicStream = async (
  options: TMusicOptions,
): Promise<TMusicStreamResult> => {
  const ffmpegPath = getFfmpegBinaryPath();
  options.log("Using FFmpeg binary at:", ffmpegPath);

  let inputSource = options.sourceUrl;
  let inputArgs: string[] = [];
  let title = options.sourceUrl;

  if (isYouTubeUrl(options.sourceUrl)) {
    const ytResult = await fetchYouTubeAudio(options.sourceUrl, {
      log: options.log,
      error: options.error,
      debug: options.debug,
    });

    inputSource = ytResult.url;
    title = ytResult.title;

    inputArgs = [
      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_delay_max",
      "5",
    ];
  }

  const volumeLevel = Math.min(100, Math.max(0, options.volume ?? 100)) / 100;

  const normalizeBitrate = (bitrate?: string): string => {
    if (!bitrate) return "192k";
    const trimmed = bitrate.trim();

    if (!trimmed) return "192k";

    if (/^\d+(?:\.\d+)?k$/i.test(trimmed)) return trimmed.toLowerCase();
    if (/^\d+$/.test(trimmed)) return trimmed;

    return "192k";
  };

  const audioBitrate = normalizeBitrate(options.bitrate);

  if (audioBitrate === "192k" && options.bitrate) {
    options.log(
      "Invalid bitrate setting, using default 192k:",
      options.bitrate,
    );
  }

  options.debug("Using audio bitrate:", audioBitrate);

  const ffmpegArgs = [
    "-hide_banner",
    "-nostats",
    "-loglevel",
    "warning",

    ...inputArgs,
    "-re",
    "-i",
    inputSource,

    "-vn",
    "-af",
    `volume=${volumeLevel}`,
    "-c:a",
    "libopus",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-b:a",
    audioBitrate,
    "-application",
    "audio",

    "-payload_type",
    String(options.audioPayloadType),
    "-ssrc",
    String(options.audioSsrc),
    "-f",
    "rtp",
    `rtp://${options.rtpHost}:${options.audioRtpPort}?pkt_size=1200`,
  ];

  options.debug("Starting music stream with FFmpeg...");
  options.debug("Command:", ffmpegPath, ...ffmpegArgs);

  const ffmpegProcess = Bun.spawn({
    cmd: [ffmpegPath, ...ffmpegArgs],
    stdout: "ignore",
    stderr: "pipe",
    stdin: "ignore",
  });

  // stderr forwarder (with a tiny yield to prevent event-loop starvation)
  (async () => {
    if (!ffmpegProcess.stderr) return;

    const reader = ffmpegProcess.stderr.getReader();
    const decoder = new TextDecoder();

    let reads = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const text = decoder.decode(value, { stream: true });

        if (text.trim()) options.error("[FFmpeg]", text.trim());

        reads++;

        if (reads % 25 === 0) await new Promise<void>((r) => setTimeout(r, 0));
      }
    } catch (err) {
      options.error("[FFmpeg stderr error]", err);
    } finally {
      try {
        reader.releaseLock();
      } catch {}
    }
  })();

  ffmpegProcess.exited.then(() => {
    options.onEnd?.();
  });

  return { process: ffmpegProcess, title };
};

const killMusicStream = (
  process: ReturnType<typeof Bun.spawn> | null,
): void => {
  if (!process) return;
  try {
    process.kill("SIGTERM");
  } catch {}
};

export { spawnMusicStream, killMusicStream };
export type { TMusicOptions, TMusicStreamResult };

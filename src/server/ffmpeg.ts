import { getFfmpegBinaryPath } from "./paths";
import {
  fetchYouTubeMetadata,
  isYouTubeUrl,
  logYtDlpLine,
  spawnYouTubeAudioPipe,
} from "./yt-dlp";

type TSpawnedStreamProcess = {
  ffmpeg: ReturnType<typeof Bun.spawn>;
  ytDlp: ReturnType<typeof Bun.spawn> | null;
};

type TMusicStreamResult = {
  process: TSpawnedStreamProcess;
  title: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
};

type TMusicOptions = {
  sourceUrl: string;
  audioPayloadType: number;
  audioSsrc: number;
  rtpHost: string;
  audioRtpPort: number;

  volume?: number; // 0-100, default 100
  bitrate?: string;
  proxy?: string;
  log: (...messages: unknown[]) => void;
  error: (...messages: unknown[]) => void;
  debug: (...messages: unknown[]) => void;
  onEnd?: () => void;
};

const FORCE_KILL_TIMEOUT_MS = 1500;

const readLines = async (
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void,
): Promise<void> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let reads = 0;

  const flush = (text: string) => {
    const trimmedLine = text.trim();

    if (trimmedLine) onLine(trimmedLine);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // progress rewrites the line with \r, so both terminators end a line
      const lines = buffer.split(/\r\n|[\n\r]/);

      buffer = lines.pop() ?? "";

      for (const line of lines) flush(line);

      // a tiny yield, so a chatty process cannot starve the event loop
      if (++reads % 25 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    }

    flush(buffer);
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
};

const logFfmpegLine = (line: string, options: TMusicOptions): void => {
  if (/\[(error|fatal|panic)\]/.test(line)) {
    options.error("[FFmpeg]", line);

    return;
  }

  options.log("[FFmpeg]", line);
};

const pendingForcedKill = new WeakSet<object>();

const terminateProcess = (
  process: ReturnType<typeof Bun.spawn> | null,
): void => {
  if (!process) return;

  let exited = false;

  process.exited.finally(() => {
    exited = true;
  });

  try {
    process.kill("SIGTERM");
  } catch {}

  if (pendingForcedKill.has(process as unknown as object)) {
    return;
  }

  pendingForcedKill.add(process as unknown as object);

  setTimeout(() => {
    pendingForcedKill.delete(process as unknown as object);

    if (exited) return;

    try {
      process.kill("SIGKILL");
    } catch {}
  }, FORCE_KILL_TIMEOUT_MS);
};

const spawnMusicStream = async (
  options: TMusicOptions,
): Promise<TMusicStreamResult> => {
  const ffmpegPath = getFfmpegBinaryPath();
  options.log("Using FFmpeg binary at:", ffmpegPath);

  let inputSource = options.sourceUrl;
  let inputArgs: string[] = [];
  let title = options.sourceUrl;
  let thumbnailUrl: string | undefined;
  let durationSeconds: number | undefined;
  let ytDlpProcess: ReturnType<typeof Bun.spawn> | null = null;

  if (isYouTubeUrl(options.sourceUrl)) {
    options.log("Using yt-dlp -> ffmpeg pipe mode for YouTube source");

    const metadata = await fetchYouTubeMetadata(options.sourceUrl, {
      log: options.log,
      error: options.error,
      debug: options.debug,
      proxy: options.proxy,
    });

    title = metadata.title;
    thumbnailUrl = metadata.thumbnailUrl;
    durationSeconds = metadata.durationSeconds;

    ytDlpProcess = await spawnYouTubeAudioPipe(options.sourceUrl, {
      log: options.log,
      error: options.error,
      debug: options.debug,
      proxy: options.proxy,
    });

    if (!ytDlpProcess.stdout) {
      throw new Error("yt-dlp pipe is not available");
    }

    inputSource = "pipe:0";
    inputArgs = [];
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
    "level+warning",

    ...inputArgs,
    "-re",
    "-readrate_initial_burst",
    "0",
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
    stdin: ytDlpProcess?.stdout ?? "ignore",
  });

  if (ffmpegProcess.stderr) {
    readLines(ffmpegProcess.stderr, (line) =>
      logFfmpegLine(line, options),
    ).catch((err: unknown) => options.error("[FFmpeg stderr error]", err));
  }

  // extractor, proxy and cookie diagnostics, most of it routine progress
  if (ytDlpProcess?.stderr && typeof ytDlpProcess.stderr !== "number") {
    readLines(ytDlpProcess.stderr, (line) => logYtDlpLine(line, options)).catch(
      (err: unknown) => options.error("[yt-dlp stderr error]", err),
    );
  }

  if (ytDlpProcess) {
    ytDlpProcess.exited.then((exitCode) => {
      if (exitCode !== 0) {
        options.error(`[yt-dlp] exited with code ${exitCode}`);
      } else {
        options.debug("[yt-dlp] stream finished");
      }
    });
  }

  ffmpegProcess.exited.then(() => {
    if (ytDlpProcess) {
      terminateProcess(ytDlpProcess);
    }

    options.onEnd?.();
  });

  return {
    process: { ffmpeg: ffmpegProcess, ytDlp: ytDlpProcess },
    title,
    thumbnailUrl,
    durationSeconds,
  };
};

const killMusicStream = (process: TSpawnedStreamProcess | null): void => {
  if (!process) return;

  terminateProcess(process.ffmpeg);

  if (process.ytDlp) {
    terminateProcess(process.ytDlp);
  }
};

export { spawnMusicStream, killMusicStream };
export type { TMusicOptions, TMusicStreamResult, TSpawnedStreamProcess };

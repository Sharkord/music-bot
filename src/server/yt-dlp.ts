import { getCookiesPath, getYtDlpBinaryPath } from "./paths";
import { pathExists } from "./downloads";

type TYtDlpResult = { url: string; title: string };
type TYtDlpMetadataResult = { title: string; thumbnailUrl?: string };

type TYtDlpOptions = {
  log: (...messages: unknown[]) => void;
  debug: (...messages: unknown[]) => void;
  error: (...messages: unknown[]) => void;
  proxy?: string;
};

const isYouTubeUrl = (url: string): boolean =>
  url.includes("youtube.com") ||
  url.includes("youtu.be") ||
  url.startsWith("ytsearch:");

const getYtDlpBaseArgs = async (options: TYtDlpOptions): Promise<string[]> => {
  const cookiesPath = getCookiesPath();
  const cookiesArgs = (await pathExists(cookiesPath))
    ? ["--cookies", cookiesPath]
    : [];
  const proxyArgs = options.proxy ? ["--proxy", options.proxy] : [];

  return [
    "--js-runtimes",
    "bun",
    "--no-warnings",
    "--no-playlist",
    ...cookiesArgs,
    ...proxyArgs,
  ];
};

const runYtDlp = async (
  cmd: string[],
  options: TYtDlpOptions,
): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  const proc = Bun.spawn({
    cmd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (stderr.trim()) options.error("[yt-dlp]", stderr.trim());

  return { stdout, stderr, exitCode };
};

const fetchYouTubeAudio = async (
  sourceUrl: string,
  options: TYtDlpOptions,
): Promise<TYtDlpResult> => {
  const ytDlpPath = getYtDlpBinaryPath();

  options.log("Using yt-dlp binary at:", ytDlpPath);
  options.log("Fetching audio URL from YouTube:", sourceUrl);

  const base = await getYtDlpBaseArgs(options);

  const cmd = [
    ytDlpPath,
    ...base,
    "-f",
    "bestaudio",
    "-g",
    "--get-title",
    sourceUrl,
  ];

  options.log("Running command:", cmd.join(" "));

  const res = await runYtDlp(cmd, options);

  if (res.exitCode !== 0) {
    throw new Error(`yt-dlp failed (exit ${res.exitCode})`);
  }

  const lines = res.stdout.trim().split(/\r?\n/).filter(Boolean);
  const title = lines[0] ?? sourceUrl;
  const url = lines[1];

  if (!url) {
    throw new Error("yt-dlp returned empty URL");
  }

  options.log("Audio URL fetched:", url);
  options.log("Title fetched:", title);

  return { url, title };
};

const parseYtDlpMetadata = (
  stdout: string,
  sourceUrl: string,
): TYtDlpMetadataResult => {
  const jsonText = stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!jsonText) {
    return { title: sourceUrl };
  }

  const parsed = JSON.parse(jsonText) as {
    title?: unknown;
    thumbnail?: unknown;
    entries?: Array<{
      title?: unknown;
      thumbnail?: unknown;
    }>;
  };

  const metadata = Array.isArray(parsed.entries)
    ? (parsed.entries.find(Boolean) ?? parsed)
    : parsed;

  const title =
    typeof metadata.title === "string" && metadata.title.trim()
      ? metadata.title.trim()
      : sourceUrl;

  const thumbnailUrl =
    typeof metadata.thumbnail === "string" && metadata.thumbnail.trim()
      ? metadata.thumbnail.trim()
      : undefined;

  return { title, thumbnailUrl };
};

const fetchYouTubeMetadata = async (
  sourceUrl: string,
  options: TYtDlpOptions,
): Promise<TYtDlpMetadataResult> => {
  const ytDlpPath = getYtDlpBinaryPath();
  const base = await getYtDlpBaseArgs(options);
  const cmd = [
    ytDlpPath,
    ...base,
    "--dump-single-json",
    "--skip-download",
    sourceUrl,
  ];

  options.log("Fetching YouTube metadata via yt-dlp:", sourceUrl);

  const res = await runYtDlp(cmd, options);

  if (res.exitCode !== 0) {
    throw new Error(`yt-dlp metadata fetch failed (exit ${res.exitCode})`);
  }

  return parseYtDlpMetadata(res.stdout, sourceUrl);
};

const spawnYouTubeAudioPipe = async (
  sourceUrl: string,
  options: TYtDlpOptions,
): Promise<ReturnType<typeof Bun.spawn>> => {
  const ytDlpPath = getYtDlpBinaryPath();
  const base = await getYtDlpBaseArgs(options);

  const cmd = [
    ytDlpPath,
    ...base,
    "-f",
    "bestaudio/best",
    "-o",
    "-",
    sourceUrl,
  ];

  options.log("Starting yt-dlp streaming pipe:", cmd.join(" "));

  return Bun.spawn({
    cmd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
};

export {
  fetchYouTubeAudio,
  fetchYouTubeMetadata,
  spawnYouTubeAudioPipe,
  isYouTubeUrl,
};
export type { TYtDlpResult, TYtDlpMetadataResult, TYtDlpOptions };

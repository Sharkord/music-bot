import { getCookiesPath, getYtDlpBinaryPath } from "./paths";
import { pathExists } from "./downloads";

type TYtDlpResult = { url: string; title: string };

type TYtDlpOptions = {
  log: (...messages: unknown[]) => void;
  debug: (...messages: unknown[]) => void;
  error: (...messages: unknown[]) => void;
};

const isYouTubeUrl = (url: string): boolean =>
  url.includes("youtube.com") ||
  url.includes("youtu.be") ||
  url.startsWith("ytsearch:");

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
  const cookiesPath = getCookiesPath();

  options.log("Using yt-dlp binary at:", ytDlpPath);
  options.log("Fetching audio URL from YouTube:", sourceUrl);

  const base = [ytDlpPath, "--js-runtimes", "bun"];
  const cookiesArgs = (await pathExists(cookiesPath))
    ? ["--cookies", cookiesPath]
    : [];

  const cmd = [
    ...base,
    ...cookiesArgs,
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

export { fetchYouTubeAudio, isYouTubeUrl };
export type { TYtDlpResult, TYtDlpOptions };

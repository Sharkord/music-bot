import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const BIN_DIR = path.join(SERVER_DIR, "bin");

const getBinaryPath = (name: string): string => path.join(BIN_DIR, name);

const getFfmpegBinaryPath = (): string =>
  getBinaryPath(process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");

const getYtDlpBinaryPath = (): string =>
  getBinaryPath(process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");

const getCookiesPath = (): string => path.join(BIN_DIR, "cookies.txt");

export {
  BIN_DIR,
  SERVER_DIR,
  getBinaryPath,
  getCookiesPath,
  getFfmpegBinaryPath,
  getYtDlpBinaryPath,
};
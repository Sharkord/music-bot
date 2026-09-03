import path from "path";

let dataDir = "";

const setDataDir = (value: string): void => {
  dataDir = value;
};

const getBinDir = (): string => path.join(dataDir, "bin");

const getDownloadDir = (): string => path.join(dataDir, "downloads");

const getBinaryPath = (name: string): string => path.join(getBinDir(), name);

const getFfmpegBinaryPath = (): string =>
  getBinaryPath(process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");

const getYtDlpBinaryPath = (): string =>
  getBinaryPath(process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");

const getCookiesPath = (): string => path.join(getBinDir(), "cookies.txt");

export {
  getBinDir,
  getBinaryPath,
  getCookiesPath,
  getDownloadDir,
  getFfmpegBinaryPath,
  getYtDlpBinaryPath,
  setDataDir,
};

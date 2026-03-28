import type { PluginContext } from "@sharkord/plugin-sdk";
import fs from "fs/promises";
import path from "path";
import {
  BIN_DIR,
  SERVER_DIR,
  getFfmpegBinaryPath,
  getYtDlpBinaryPath,
} from "./paths";

type TDownloadLogger = Pick<PluginContext, "log" | "error">;

const downloadPaths: {
  [key: string]: {
    ffmpeg: string;
    ytDlp: string;
  };
} = {
  linux_x64: {
    ffmpeg:
      "https://github.com/diogomartino/plugin-binaries/releases/latest/download/ffmpeg-linux-x64.tar.gz",
    ytDlp:
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux",
  },
  linux_arm64: {
    ffmpeg:
      "https://github.com/diogomartino/plugin-binaries/releases/latest/download/ffmpeg-linux-arm64.tar.gz",
    ytDlp:
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64",
  },
  win32_x64: {
    ffmpeg:
      "https://github.com/diogomartino/plugin-binaries/releases/latest/download/ffmpeg-win64.tar.gz",
    ytDlp:
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
  },
};

const DOWNLOAD_DIR = path.join(SERVER_DIR, "downloads");

const ensureDir = async (dir: string, logger?: TDownloadLogger) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    logger?.error(`Failed to create directory ${dir}:`, err);
    throw err;
  }
};

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const getPlatformArch = (): string => `${process.platform}_${process.arch}`;

const getFfmpegBinaryName = (): string => path.basename(getFfmpegBinaryPath());

const getYtDlpBinaryName = (): string => path.basename(getYtDlpBinaryPath());

const findFileRecursive = async (
  rootDir: string,
  fileName: string,
): Promise<string | null> => {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.isFile() && entry.name === fileName) {
      return entryPath;
    }

    if (entry.isDirectory()) {
      const nestedPath = await findFileRecursive(entryPath, fileName);

      if (nestedPath) {
        return nestedPath;
      }
    }
  }

  return null;
};

const extractArchive = async (
  archivePath: string,
  extractPath: string,
  logger: TDownloadLogger,
): Promise<void> => {
  await ensureDir(extractPath, logger);
  logger.log(`Extracting archive ${archivePath} to ${extractPath}`);

  const tarball = await Bun.file(archivePath).bytes();
  const archive = new Bun.Archive(tarball);
  const entryCount = await archive.extract(extractPath);

  logger.log(`Extracted ${entryCount} entries from ${archivePath}`);
};

const downloadFile = async (
  url: string,
  outputPath: string,
  logger: TDownloadLogger,
): Promise<void> => {
  await ensureDir(path.dirname(outputPath), logger);
  logger.log(`Starting download from ${url} to ${outputPath}`);

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status} ${res.statusText}`);
  }

  if (!res.body) {
    throw new Error(`Download response has no body: ${url}`);
  }

  const totalBytesHeader = res.headers.get("content-length");
  const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : NaN;
  const hasTotalBytes = Number.isFinite(totalBytes) && totalBytes > 0;
  const file = await fs.open(outputPath, "w");
  const reader = res.body.getReader();

  let downloadedBytes = 0;
  let lastLoggedPercent = -1;
  let lastLoggedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      await file.write(value);

      downloadedBytes += value.byteLength;

      if (hasTotalBytes) {
        const percent = Math.floor((downloadedBytes / totalBytes) * 100);

        if (percent >= lastLoggedPercent + 10 || percent === 100) {
          logger.log(
            `Downloading ${path.basename(outputPath)}: ${percent}% (${downloadedBytes}/${totalBytes} bytes)`,
          );

          lastLoggedPercent = percent;
        }

        continue;
      }

      const byteLogStep = 5 * 1024 * 1024;

      if (downloadedBytes - lastLoggedBytes >= byteLogStep) {
        logger.log(
          `Downloading ${path.basename(outputPath)}: ${downloadedBytes} bytes`,
        );
        lastLoggedBytes = downloadedBytes;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}

    await file.close();
  }

  if (hasTotalBytes) {
    logger.log(
      `Finished downloading ${path.basename(outputPath)}: ${downloadedBytes}/${totalBytes} bytes`,
    );
    return;
  }

  logger.log(
    `Finished downloading ${path.basename(outputPath)}: ${downloadedBytes} bytes`,
  );
};

const ensureBinaryTargetPath = async (
  binaryPath: string,
  logger: TDownloadLogger,
): Promise<void> => {
  await ensureDir(BIN_DIR, logger);

  if (!(await pathExists(binaryPath))) {
    return;
  }

  const existing = await fs.stat(binaryPath);

  if (existing.isDirectory()) {
    logger.log(`Removing stale directory at ${binaryPath}`);
    await fs.rm(binaryPath, { recursive: true, force: true });
  }
};

const makeExecutable = async (binaryPath: string): Promise<void> => {
  if (process.platform !== "win32") {
    await fs.chmod(binaryPath, 0o755);
  }
};

const getDownloadUrl = (arch: string, binary: "ffmpeg" | "ytDlp"): string => {
  const url = downloadPaths[arch]?.[binary];

  if (!url) {
    throw new Error(
      `No ${binary} download URL configured for architecture: ${arch}`,
    );
  }

  return url;
};

const downloadFFmpeg = async (logger: TDownloadLogger) => {
  const arch = getPlatformArch();
  const url = getDownloadUrl(arch, "ffmpeg");
  const binaryName = getFfmpegBinaryName();
  const binaryPath = getFfmpegBinaryPath();

  logger.log(`Downloading FFmpeg for architecture: ${arch} from URL: ${url}`);

  const urlFilename = path.basename(new URL(url).pathname);
  const extractedName = urlFilename.replace(/\.tar\.gz$/, "");
  const archivePath = path.join(DOWNLOAD_DIR, `ffmpeg_${arch}.tar.gz`);
  const extractPath = path.join(DOWNLOAD_DIR, `ffmpeg_extract_${arch}`);

  await ensureDir(DOWNLOAD_DIR, logger);
  await ensureBinaryTargetPath(binaryPath, logger);

  await fs.rm(extractPath, { recursive: true, force: true });

  await downloadFile(url, archivePath, logger);

  await extractArchive(archivePath, extractPath, logger);

  const extractedBinaryPath =
    (await findFileRecursive(extractPath, extractedName)) ??
    (await findFileRecursive(extractPath, binaryName));

  if (!extractedBinaryPath) {
    throw new Error(
      `Could not find ${extractedName} or ${binaryName} in extracted archive: ${archivePath}`,
    );
  }

  await fs.copyFile(extractedBinaryPath, binaryPath);
  await makeExecutable(binaryPath);
  await fs.rm(extractPath, { recursive: true, force: true });

  logger.log(`FFmpeg downloaded successfully to ${binaryPath}`);
};

const downloadYtDlp = async (logger: TDownloadLogger) => {
  const arch = getPlatformArch();
  const url = getDownloadUrl(arch, "ytDlp");
  const binaryPath = getYtDlpBinaryPath();
  const binaryName = getYtDlpBinaryName();
  const archivePath = path.join(DOWNLOAD_DIR, `${binaryName}_${arch}`);

  logger.log(`Downloading yt-dlp for architecture: ${arch} from URL: ${url}`);

  await ensureDir(DOWNLOAD_DIR, logger);
  await ensureBinaryTargetPath(binaryPath, logger);
  await downloadFile(url, archivePath, logger);
  await fs.copyFile(archivePath, binaryPath);
  await makeExecutable(binaryPath);

  logger.log(`yt-dlp downloaded successfully to ${binaryPath}`);
};

const ensureBinary = async (
  binaryPath: string,
  download: (logger: TDownloadLogger) => Promise<void>,
  logger: TDownloadLogger,
): Promise<void> => {
  if (await pathExists(binaryPath)) {
    const stats = await fs.stat(binaryPath);

    if (stats.isFile()) {
      logger.log(`Using existing binary at ${binaryPath}`);
      return;
    }
  }

  logger.log(`Binary missing at ${binaryPath}, starting download`);
  await download(logger);
};

const areRequiredBinariesPresent = async (): Promise<boolean> => {
  const [ffmpegExists, ytDlpExists] = await Promise.all([
    pathExists(getFfmpegBinaryPath()),
    pathExists(getYtDlpBinaryPath()),
  ]);

  return ffmpegExists && ytDlpExists;
};

const ensureRequiredBinaries = async (ctx: PluginContext) => {
  ctx.log("Ensuring required music binaries are available");

  await Promise.all([
    ensureBinary(getFfmpegBinaryPath(), downloadFFmpeg, ctx),
    ensureBinary(getYtDlpBinaryPath(), downloadYtDlp, ctx),
  ]);

  try {
    ctx.log(`Cleaning temporary download directory ${DOWNLOAD_DIR}`);
    await fs.rm(DOWNLOAD_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }

  ctx.log("Required music binaries are available");
};

export { areRequiredBinariesPresent, ensureRequiredBinaries, pathExists };

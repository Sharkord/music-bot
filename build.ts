import { build } from "@sharkord/plugin-builder";
import { PLUGIN_SDK_VERSION } from "@sharkord/plugin-sdk";
import fs from "fs/promises";
import path from "path";

// Set SHARKORD_PLUGINS_PATH in .env and every build lands straight in your
// server, which is most of the edit-build-reload loop. See .env.example.
const pluginsPath = process.env.SHARKORD_PLUGINS_PATH;

const result = await build({ sdkVersion: PLUGIN_SDK_VERSION });

if (pluginsPath) {
  const targetPath = path.join(pluginsPath, path.basename(result.outDir));

  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.cp(result.outDir, targetPath, { recursive: true });

  console.log(`Copied the built plugin to ${targetPath}`);
}

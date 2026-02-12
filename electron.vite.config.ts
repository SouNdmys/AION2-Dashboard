import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

type PackageJson = {
  version?: string;
  author?: string | { name?: string };
};

const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf-8")) as PackageJson;
const appVersion = packageJson.version ?? "0.0.0";
const appAuthor =
  typeof packageJson.author === "string" ? packageJson.author : (packageJson.author?.name ?? "Unknown");
const buildTime = new Date().toISOString();

const defineBuildMeta = {
  __APP_VERSION__: JSON.stringify(appVersion),
  __BUILD_TIME__: JSON.stringify(buildTime),
  __APP_AUTHOR__: JSON.stringify(appAuthor),
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: defineBuildMeta,
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define: defineBuildMeta,
  },
  renderer: {
    plugins: [react()],
    define: defineBuildMeta,
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
      },
    },
  },
});

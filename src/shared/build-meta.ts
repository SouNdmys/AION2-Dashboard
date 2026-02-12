import type { AppBuildInfo } from "./types";

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
declare const __APP_AUTHOR__: string;

export const APP_BUILD_INFO: AppBuildInfo = {
  version: __APP_VERSION__,
  buildTime: __BUILD_TIME__,
  author: __APP_AUTHOR__,
};

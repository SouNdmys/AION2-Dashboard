/// <reference types="vite/client" />

import type { AionApi } from "../../preload";

declare global {
  interface Window {
    aionApi: AionApi;
  }
}

export {};


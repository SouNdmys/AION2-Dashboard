import { useMemo } from "react";

export function useAionApi(): NonNullable<Window["aionApi"]> {
  return useMemo(() => {
    if (!window.aionApi) {
      throw new Error("Preload API unavailable: window.aionApi is undefined");
    }
    return window.aionApi;
  }, []);
}

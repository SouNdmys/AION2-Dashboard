import { useAionApi } from "../../../hooks/useAionApi";

export function useAppActions(): NonNullable<Window["aionApi"]> {
  return useAionApi();
}

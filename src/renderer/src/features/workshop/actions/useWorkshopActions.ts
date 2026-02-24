import { useAionApi } from "../../../hooks/useAionApi";

export function useWorkshopActions(): NonNullable<Window["aionApi"]> {
  return useAionApi();
}

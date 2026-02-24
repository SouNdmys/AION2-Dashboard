import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type StateInitializer<T> = T | (() => T);

export function usePersistedState<T>(
  storageKey: string,
  initialState: StateInitializer<T>,
  serialize: (value: T) => string = JSON.stringify,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initialState);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, serialize(value));
    } catch {
      // ignore local storage write failures
    }
  }, [storageKey, value, serialize]);

  return [value, setValue];
}

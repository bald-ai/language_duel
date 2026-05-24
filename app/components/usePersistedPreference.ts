"use client";

import { useCallback, useEffect, useState } from "react";

type PersistedPreferenceOptions<T extends string> = {
  defaultValue: T;
  storageKey: string;
  serverValue: string | null | undefined;
  serverValueLoaded: boolean;
  isValid: (value: string) => value is T;
  saveValue?: (value: T) => Promise<unknown>;
  onSaveError?: (error: unknown) => void;
};

export function usePersistedPreference<T extends string>({
  defaultValue,
  storageKey,
  serverValue,
  serverValueLoaded,
  isValid,
  saveValue,
  onSaveError,
}: PersistedPreferenceOptions<T>) {
  const [value, setValueState] = useState<T>(defaultValue);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [hasAppliedServerValue, setHasAppliedServerValue] = useState(false);

  const applyAndStore = useCallback(
    (nextValue: T) => {
      window.localStorage.setItem(storageKey, nextValue);
      setValueState(nextValue);
    },
    [storageKey]
  );

  useEffect(() => {
    if (hasHydrated) return;

    const storedValue = window.localStorage.getItem(storageKey);
    if (storedValue && isValid(storedValue)) {
      queueMicrotask(() => applyAndStore(storedValue));
    }
    queueMicrotask(() => setHasHydrated(true));
  }, [applyAndStore, hasHydrated, isValid, storageKey]);

  useEffect(() => {
    if (!hasHydrated || !serverValueLoaded || hasAppliedServerValue) return;

    if (serverValue && isValid(serverValue)) {
      queueMicrotask(() => applyAndStore(serverValue));
    }
    queueMicrotask(() => setHasAppliedServerValue(true));
  }, [
    applyAndStore,
    hasAppliedServerValue,
    hasHydrated,
    isValid,
    serverValue,
    serverValueLoaded,
  ]);

  const setValue = useCallback(
    (nextValue: T) => {
      if (!isValid(nextValue)) return;

      applyAndStore(nextValue);
      if (saveValue && serverValueLoaded) {
        saveValue(nextValue).catch(onSaveError);
      }
    },
    [applyAndStore, isValid, onSaveError, saveValue, serverValueLoaded]
  );

  return { value, setValue };
}

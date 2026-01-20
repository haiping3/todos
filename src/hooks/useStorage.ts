/**
 * React hook for Chrome storage with type safety
 * @author haiping.yu@zoom.us
 */

import { useState, useEffect, useCallback } from 'react';

interface UseStorageResult<T> {
  value: T;
  setValue: (newValue: T) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to use Chrome storage with React state
 */
export function useStorage<T>(key: string, defaultValue: T): UseStorageResult<T> {
  const [value, setLocalValue] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load initial value
  useEffect(() => {
    const loadValue = async () => {
      try {
        const result = await chrome.storage.local.get(key);
        if (result[key] !== undefined) {
          setLocalValue(result[key] as T);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Storage error'));
      } finally {
        setIsLoading(false);
      }
    };

    loadValue();
  }, [key]);

  // Listen for changes
  useEffect(() => {
    const handleChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[key]) {
        setLocalValue(changes[key].newValue as T);
      }
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, [key]);

  // Set value
  const setValue = useCallback(
    async (newValue: T) => {
      try {
        await chrome.storage.local.set({ [key]: newValue });
        setLocalValue(newValue);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Storage error'));
        throw err;
      }
    },
    [key]
  );

  return { value, setValue, isLoading, error };
}

/**
 * Hook for boolean storage values with toggle
 */
export function useStorageToggle(
  key: string,
  defaultValue: boolean
): UseStorageResult<boolean> & { toggle: () => Promise<void> } {
  const result = useStorage(key, defaultValue);

  const toggle = useCallback(async () => {
    await result.setValue(!result.value);
  }, [result]);

  return { ...result, toggle };
}


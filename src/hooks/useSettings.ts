/**
 * React hook for managing app settings
 * @author haiping.yu@zoom.us
 */

import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, ThemeMode, AutoSyncConfig } from '@/types';

const SETTINGS_KEY = 'app_settings';

const DEFAULT_AUTO_SYNC_CONFIG: AutoSyncConfig = {
  enabled: false,
  intervalMinutes: 5,
  debounceSeconds: 5,
  syncOnNetworkRestore: true,
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  notifications: true,
  autoSummarize: true,
  summaryThreshold: 80,
  syncEnabled: false,
  autoSync: DEFAULT_AUTO_SYNC_CONFIG,
  reminderDefaults: {
    beforeDeadline: 30, // 30 minutes
  },
};

interface UseSettingsResult {
  settings: AppSettings;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  toggleNotifications: () => Promise<void>;
  toggleAutoSummarize: () => Promise<void>;
  // Auto sync methods
  toggleAutoSync: () => Promise<void>;
  updateAutoSyncConfig: (config: Partial<AutoSyncConfig>) => Promise<void>;
}

/**
 * Hook for managing application settings
 */
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load settings from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.local.get(SETTINGS_KEY);
        const stored = result[SETTINGS_KEY];
        if (stored) {
          setSettings({ ...DEFAULT_SETTINGS, ...stored });
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load settings'));
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Listen for changes
  useEffect(() => {
    const handleChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[SETTINGS_KEY]) {
        setSettings({ ...DEFAULT_SETTINGS, ...changes[SETTINGS_KEY].newValue });
      }
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  // Apply theme
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // Update settings
  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates };
    await chrome.storage.local.set({ [SETTINGS_KEY]: newSettings });
    setSettings(newSettings);
  }, [settings]);

  // Reset to defaults
  const resetSettings = useCallback(async () => {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Convenience methods
  const setTheme = useCallback(async (theme: ThemeMode) => {
    await updateSettings({ theme });
  }, [updateSettings]);

  const toggleNotifications = useCallback(async () => {
    await updateSettings({ notifications: !settings.notifications });
  }, [settings.notifications, updateSettings]);

  const toggleAutoSummarize = useCallback(async () => {
    await updateSettings({ autoSummarize: !settings.autoSummarize });
  }, [settings.autoSummarize, updateSettings]);

  // Toggle auto sync on/off
  const toggleAutoSync = useCallback(async () => {
    const currentConfig = settings.autoSync || DEFAULT_AUTO_SYNC_CONFIG;
    const newConfig = { ...currentConfig, enabled: !currentConfig.enabled };
    await updateSettings({ autoSync: newConfig });
    
    // Notify service worker to update alarm
    chrome.runtime.sendMessage({ type: 'UPDATE_AUTO_SYNC_CONFIG' }).catch(() => {
      // Service worker may not be ready, that's okay
    });
  }, [settings.autoSync, updateSettings]);

  // Update auto sync configuration
  const updateAutoSyncConfig = useCallback(async (config: Partial<AutoSyncConfig>) => {
    const currentConfig = settings.autoSync || DEFAULT_AUTO_SYNC_CONFIG;
    const newConfig = { ...currentConfig, ...config };
    await updateSettings({ autoSync: newConfig });
    
    // Notify service worker to update alarm
    chrome.runtime.sendMessage({ type: 'UPDATE_AUTO_SYNC_CONFIG' }).catch(() => {
      // Service worker may not be ready, that's okay
    });
  }, [settings.autoSync, updateSettings]);

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    resetSettings,
    setTheme,
    toggleNotifications,
    toggleAutoSummarize,
    toggleAutoSync,
    updateAutoSyncConfig,
  };
}

/**
 * Apply theme to document
 */
function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

/**
 * Get current effective theme (resolves 'system' to actual value)
 */
export function getEffectiveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

export { DEFAULT_SETTINGS };


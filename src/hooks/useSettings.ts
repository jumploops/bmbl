import { useState, useEffect, useCallback } from 'react';
import { getSettings, updateSettings, onSettingsChange } from '@/lib/settings';
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

interface UseSettingsReturn {
  settings: Settings;
  isLoading: boolean;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load initial settings
    getSettings()
      .then(setSettings)
      .finally(() => setIsLoading(false));

    // Listen for changes
    const unsubscribe = onSettingsChange(setSettings);
    return unsubscribe;
  }, []);

  const updateSetting = useCallback(async <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ): Promise<void> => {
    // Optimistic update
    setSettings((prev) => ({ ...prev, [key]: value }));

    try {
      await updateSettings({ [key]: value });
    } catch (error) {
      // Revert on error
      const currentSettings = await getSettings();
      setSettings(currentSettings);
      throw error;
    }
  }, []);

  return { settings, isLoading, updateSetting };
}

import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

const SETTINGS_KEY = 'settings';

/**
 * Get all settings
 */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<Settings> | undefined;
  const settings = { ...DEFAULT_SETTINGS, ...stored };

  // Migrate 'priority' to 'favorites' (Phase 7 migration)
  if ((settings.defaultView as string) === 'priority') {
    settings.defaultView = 'favorites';
    // Persist the migration
    await updateSettings({ defaultView: 'favorites' });
  }

  return settings;
}

/**
 * Update settings (partial)
 */
export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  const newSettings = { ...current, ...updates };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: newSettings });
}

/**
 * Initialize settings on install
 */
export async function initializeSettings(): Promise<void> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  if (!result[SETTINGS_KEY]) {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  }
}

/**
 * Listen for settings changes
 */
export function onSettingsChange(callback: (settings: Settings) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes[SETTINGS_KEY]) {
      const newValue = changes[SETTINGS_KEY].newValue as Partial<Settings> | undefined;
      callback({ ...DEFAULT_SETTINGS, ...newValue });
    }
  };

  chrome.storage.sync.onChanged.addListener(listener);

  // Return unsubscribe function
  return () => chrome.storage.sync.onChanged.removeListener(listener);
}

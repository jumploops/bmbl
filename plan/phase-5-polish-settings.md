# Phase 5: Polish & Settings

**Goal**: Complete the extension with the options page, default view integration, troubleshooting info, and final polish.

**Dependencies**: Phase 1-4, Phase 6 (duplicate tab counting), Phase 7 (favorites redesign)

**Estimated scope**: Small

> **Note**: This plan has been updated to reflect changes from Phase 6 (tab aggregation) and Phase 7 (favorites redesign where `score` → `favoritedAt`, `priority` → `favorites`, `upvote`/`downvote` → `favorite`/`unfavorite`).

---

## Overview

This phase implements:
- Options page with settings UI
- Troubleshooting section
- Default view setting integration
- Live refresh when capture completes
- Final UI polish and consistency

---

## Implementation Steps

### 1. Settings Hook

**src/hooks/useSettings.ts**
```tsx
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
```

### 2. Toggle Component

**src/components/ui/Toggle.tsx**
```tsx
import { cn } from '@/lib/utils/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export function Toggle({ checked, onChange, disabled, id }: ToggleProps) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-hn-header' : 'bg-gray-300',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );
}
```

### 3. Select Component

**src/components/ui/Select.tsx**
```tsx
import { cn } from '@/lib/utils/cn';

interface SelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
  id?: string;
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
  id,
}: SelectProps<T>) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      disabled={disabled}
      className={cn(
        'border border-gray-300 rounded px-2 py-1 text-sm',
        'focus:outline-none focus:ring-2 focus:ring-hn-header',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
```

### 4. Options Page App

**src/entrypoints/options/App.tsx**
```tsx
import { useSettings } from '@/hooks/useSettings';
import { Toggle } from '@/components/ui/Toggle';
import { Select } from '@/components/ui/Select';
import type { ViewType } from '@/types';

const VIEW_OPTIONS: { value: ViewType; label: string }[] = [
  { value: 'new', label: 'New (most recent)' },
  { value: 'old', label: 'Old (oldest first)' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'frequent', label: 'Frequent (most saved)' },
];

export default function App() {
  const { settings, isLoading, updateSetting } = useSettings();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-hn-bg font-hn p-6">
        <p className="text-hn-text-secondary">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hn-bg font-hn">
      {/* Header */}
      <header className="bg-hn-header text-white px-4 py-2">
        <h1 className="text-lg font-bold">bmbl Settings</h1>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        {/* Settings Section */}
        <section className="mb-8">
          <h2 className="text-base font-bold mb-4 border-b border-gray-300 pb-2">
            Behavior
          </h2>

          {/* Auto-close setting */}
          <div className="flex items-start justify-between py-3 border-b border-gray-100">
            <div className="flex-1 pr-4">
              <label htmlFor="autoClose" className="font-medium cursor-pointer">
                Auto-close after save
              </label>
              <p className="text-sm text-hn-text-secondary mt-1">
                When enabled, bmbl will close saved tabs after capturing them.
                Pinned tabs are never closed.
              </p>
            </div>
            <Toggle
              id="autoClose"
              checked={settings.autoCloseAfterSave}
              onChange={(value) => updateSetting('autoCloseAfterSave', value)}
            />
          </div>

          {/* Default view setting */}
          <div className="flex items-start justify-between py-3 border-b border-gray-100">
            <div className="flex-1 pr-4">
              <label htmlFor="defaultView" className="font-medium">
                Default view
              </label>
              <p className="text-sm text-hn-text-secondary mt-1">
                Which view to show when opening a new tab.
              </p>
            </div>
            <Select
              id="defaultView"
              value={settings.defaultView}
              onChange={(value) => updateSetting('defaultView', value)}
              options={VIEW_OPTIONS}
            />
          </div>
        </section>

        {/* Troubleshooting Section */}
        <section className="mb-8">
          <h2 className="text-base font-bold mb-4 border-b border-gray-300 pb-2">
            Troubleshooting
          </h2>

          <div className="bg-gray-50 border border-gray-200 rounded p-4">
            <h3 className="font-medium mb-2">
              bmbl is not showing on New Tab?
            </h3>
            <p className="text-sm text-hn-text-secondary mb-3">
              Another extension may be controlling your New Tab page.
              Only one extension can override New Tab at a time.
            </p>
            <p className="text-sm text-hn-text-secondary">
              <strong>To fix:</strong> Go to{' '}
              <code className="bg-gray-200 px-1 rounded">chrome://extensions</code>,
              find other extensions that override New Tab, and disable them.
            </p>
          </div>
        </section>

        {/* About Section */}
        <section>
          <h2 className="text-base font-bold mb-4 border-b border-gray-300 pb-2">
            About
          </h2>

          <div className="text-sm text-hn-text-secondary">
            <p className="mb-2">
              <strong>Bookmark Backlog (bmbl)</strong> v0.1.0
            </p>
            <p>
              Save all your tabs with one click. Triage your reading backlog
              with a Hacker News-style interface.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
```

### 5. Update ViewContext for Default View

**src/contexts/ViewContext.tsx** (update to use settings):
```tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getSettings } from '@/lib/settings';
import type { ViewType } from '@/types';

interface ViewContextValue {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  isLoading: boolean;
}

const ViewContext = createContext<ViewContextValue | null>(null);

export function ViewProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentView] = useState<ViewType>('new');
  const [isLoading, setIsLoading] = useState(true);

  // Load default view from settings
  useEffect(() => {
    getSettings()
      .then((settings) => {
        setCurrentView(settings.defaultView);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const setView = useCallback((view: ViewType) => {
    setCurrentView(view);
  }, []);

  return (
    <ViewContext.Provider value={{ currentView, setView, isLoading }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView(): ViewContextValue {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error('useView must be used within a ViewProvider');
  }
  return context;
}
```

### 6. Live Refresh Hook

**src/hooks/useCaptureListener.ts**

> **Note**: Uses `chrome.storage.onChanged` instead of `chrome.runtime.onMessage` because storage changes are more reliable for cross-context communication in MV3 extensions.

```tsx
import { useEffect } from 'react';

/**
 * Listens for capture completion by watching chrome.storage.local changes.
 * This is more reliable than chrome.runtime.sendMessage for MV3 extensions,
 * as storage changes are guaranteed to fire in all extension contexts.
 */
export function useCaptureListener(onCaptureComplete: () => void): void {
  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.lastCaptureTime) {
        onCaptureComplete();
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [onCaptureComplete]);
}
```

### 7. Update Background Script

**src/entrypoints/background.ts** (add after capture completes):
```typescript
// Signal capture complete via storage (for live refresh in new tab pages)
// This is more reliable than chrome.runtime.sendMessage in MV3
await chrome.storage.local.set({ lastCaptureTime: Date.now() });
```

### 8. Update New Tab App

**src/entrypoints/newtab/App.tsx** (add live refresh):
```tsx
import { useCaptureListener } from '@/hooks/useCaptureListener';

// Inside NewTabContent component:
const { refresh } = useItems(currentView);

// Listen for capture completion and refresh the list
useCaptureListener(refresh);
```

### 9. Dark Mode Polish

Update **src/styles/globals.css** with comprehensive dark mode:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --hn-bg: #f6f6ef;
  --hn-header: #7c3aed;
  --hn-text: #000000;
  --hn-text-secondary: #828282;
  --hn-link: #000000;
}

.dark {
  --hn-bg: #1a1a1a;
  --hn-header: #5b21b6;
  --hn-text: #e5e5e5;
  --hn-text-secondary: #a0a0a0;
  --hn-link: #e5e5e5;
}

body {
  font-family: Verdana, Geneva, sans-serif;
  font-size: 10pt;
  background-color: var(--hn-bg);
  color: var(--hn-text);
}

a {
  color: var(--hn-link);
}

/* Ensure proper dark mode for inputs */
.dark input,
.dark select {
  background-color: #2a2a2a;
  color: #e5e5e5;
  border-color: #444;
}
```

---

## Files to Create/Update

| File | Purpose |
|------|---------|
| `src/components/ui/Toggle.tsx` | Toggle switch component |
| `src/components/ui/Select.tsx` | Select dropdown component |
| `src/hooks/useSettings.ts` | Settings hook |
| `src/hooks/useCaptureListener.ts` | Listen for capture completion |
| `src/entrypoints/options/App.tsx` | Options page (update) |
| `src/entrypoints/background.ts` | Add capture complete notification (update) |
| `src/entrypoints/newtab/App.tsx` | Add live refresh listener (update) |
| `src/contexts/ViewContext.tsx` | View context (update with default view) |
| `src/styles/globals.css` | Global styles (update for dark mode) |

---

## Acceptance Criteria

- [ ] Options page loads and displays settings
- [ ] Auto-close toggle works and persists
- [ ] Default view select works and persists
- [ ] Default view is used when opening new tab
- [ ] Troubleshooting section displays correctly
- [ ] **Live refresh**: New tab page auto-refreshes when capture completes
- [ ] Dark mode works on options page
- [ ] All styles are consistent in dark mode

---

## Testing

### Manual Testing Checklist

1. **Settings**
   - Open options page
   - Toggle auto-close → save tabs → verify behavior
   - Change default view → open new tab → verify correct view

2. **Live Refresh**
   - Open new tab page (bmbl)
   - Open some other tabs with URLs
   - Click bmbl icon to capture
   - Verify new tab page automatically shows the new items (no manual refresh needed)

3. **Dark Mode**
   - Toggle system dark mode
   - Options page colors update
   - New tab page colors update
   - Inputs and selects have correct colors

4. **Troubleshooting**
   - Verify troubleshooting text is helpful
   - chrome://extensions link is visible

---

## V1 Completion Checklist

After this phase, verify the complete V1 feature set:

- [ ] **Capture**: Click icon → all tabs saved
- [ ] **Live Refresh**: New tab page auto-updates when capture completes
- [ ] **Dedupe**: Same URL → single item with updated saveCount (Phase 6: tabs aggregated by URL)
- [ ] **Views**: new, old, favorites, frequent, hidden all work
- [ ] **Favorites**: HN-style triangle arrow to favorite, "unfavorite" link to remove (Phase 7)
- [ ] **Points**: Display saveCount (automatic relevance from tab captures)
- [ ] **Hide/Restore**: Items can be hidden and restored
- [ ] **Pagination**: Infinite scroll loads more items
- [ ] **Settings**: Auto-close and default view work
- [ ] **Icon States**: Default → Loading → Success → Default
- [ ] **Dark Mode**: System preference respected

---

## Notes

- Settings sync across Chrome instances via chrome.storage.sync
- Default view loads from settings before rendering items

---

## Future Enhancements (V1.1+)

- Manual dark mode toggle (in addition to system preference)
- Keyboard shortcuts
- Batch hide/restore
- Export/import data
- UTM parameter stripping
- Session/batch view

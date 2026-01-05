import { useSettings } from '@/hooks/useSettings';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Toggle } from '@/components/ui/Toggle';
import { Select } from '@/components/ui/Select';
import type { ViewType, DarkMode } from '@/types';

const VIEW_OPTIONS: { value: ViewType; label: string }[] = [
  { value: 'new', label: 'New (most recent)' },
  { value: 'old', label: 'Old (oldest first)' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'frequent', label: 'Frequent (most saved)' },
];

const DARK_MODE_OPTIONS: { value: DarkMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function App() {
  const { settings, isLoading, updateSetting } = useSettings();
  useDarkMode(settings.darkMode); // Apply dark mode class to html

  if (isLoading) {
    return (
      <div className="min-h-screen bg-hn-bg font-[family-name:var(--font-hn)] p-6">
        <p className="text-hn-text-secondary">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hn-bg font-[family-name:var(--font-hn)] text-hn-text">
      {/* Header */}
      <header className="bg-hn-header text-white px-4 py-2">
        <h1 className="text-lg font-bold">bmbl Settings</h1>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        {/* Settings Section */}
        <section className="mb-8">
          <h2 className="text-base font-bold mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
            Behavior
          </h2>

          {/* Auto-close setting */}
          <div className="flex items-start justify-between py-3 border-b border-gray-100 dark:border-gray-700">
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
          <div className="flex items-start justify-between py-3">
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

        {/* Appearance Section */}
        <section className="mb-8">
          <h2 className="text-base font-bold mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
            Appearance
          </h2>

          {/* Dark mode setting */}
          <div className="flex items-start justify-between py-3">
            <div className="flex-1 pr-4">
              <label htmlFor="darkMode" className="font-medium">
                Theme
              </label>
              <p className="text-sm text-hn-text-secondary mt-1">
                Choose light, dark, or follow your system setting.
              </p>
            </div>
            <Select
              id="darkMode"
              value={settings.darkMode}
              onChange={(value) => updateSetting('darkMode', value)}
              options={DARK_MODE_OPTIONS}
            />
          </div>
        </section>

        {/* Troubleshooting Section */}
        <section className="mb-8">
          <h2 className="text-base font-bold mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
            Troubleshooting
          </h2>

          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4">
            <h3 className="font-medium mb-2">
              bmbl is not showing on New Tab?
            </h3>
            <p className="text-sm text-hn-text-secondary mb-3">
              Another extension may be controlling your New Tab page.
              Only one extension can override New Tab at a time.
            </p>
            <p className="text-sm text-hn-text-secondary">
              <strong>To fix:</strong> Go to{' '}
              <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">chrome://extensions</code>,
              find other extensions that override New Tab, and disable them.
            </p>
          </div>
        </section>

        {/* About Section */}
        <section>
          <h2 className="text-base font-bold mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
            About
          </h2>

          <div className="text-sm text-hn-text-secondary">
            <p className="mb-2">
              <strong>Bookmark Backlog (bmbl)</strong> v0.0.1
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

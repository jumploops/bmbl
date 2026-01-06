import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useImportExport } from '@/hooks/useImportExport';
import { Toggle } from '@/components/ui/Toggle';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
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

  // Import/Export state
  const [includeHidden, setIncludeHidden] = useState(false);
  const [conflictStrategy, setConflictStrategy] = useState<'skip' | 'merge'>('skip');
  const {
    exportBookmarks,
    isExporting,
    fileInputRef,
    openFilePicker,
    handleFileSelect,
    validation,
    clearValidation,
    confirmImport,
    isValidating,
    isImporting,
    status,
    message,
    clearMessage,
  } = useImportExport();

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
          <div className="flex items-start justify-between py-3 border-b border-gray-100 dark:border-gray-700">
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

          {/* Show favicons setting */}
          <div className="flex items-start justify-between py-3">
            <div className="flex-1 pr-4">
              <label htmlFor="showFavicons" className="font-medium cursor-pointer">
                Show favicons
              </label>
              <p className="text-sm text-hn-text-secondary mt-1">
                Display site icons next to bookmark titles.
              </p>
            </div>
            <Toggle
              id="showFavicons"
              checked={settings.showFavicons}
              onChange={(value) => updateSetting('showFavicons', value)}
            />
          </div>
        </section>

        {/* Data Section */}
        <section className="mb-8">
          <h2 className="text-base font-bold mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
            Data
          </h2>

          {/* Status message */}
          {message && (
            <div
              className={`mb-4 p-3 rounded text-sm ${
                status === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex justify-between items-center">
                <span>{message}</span>
                <button
                  onClick={clearMessage}
                  className="text-current hover:opacity-70 ml-2"
                >
                  &times;
                </button>
              </div>
            </div>
          )}

          {/* Export */}
          <div className="py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-medium mb-2">Export Bookmarks</h3>
            <p className="text-sm text-hn-text-secondary mb-3">
              Download your bmbl bookmarks as a JSON file.
            </p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeHidden}
                  onChange={(e) => setIncludeHidden(e.target.checked)}
                  className="rounded"
                />
                Include hidden items
              </label>
              <Button
                onClick={() => exportBookmarks({ includeHidden })}
                disabled={isExporting}
                size="sm"
              >
                {isExporting ? 'Exporting...' : 'Export JSON'}
              </Button>
            </div>
          </div>

          {/* Import */}
          <div className="py-3">
            <h3 className="font-medium mb-2">Import Bookmarks</h3>
            <p className="text-sm text-hn-text-secondary mb-3">
              Import from a bmbl export or browser bookmark file (Chrome, Firefox, Safari, Edge).
            </p>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.html,.htm"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!validation ? (
              // File picker
              <Button
                onClick={openFilePicker}
                disabled={isValidating}
                variant="secondary"
                size="sm"
              >
                {isValidating ? 'Validating...' : 'Choose File'}
              </Button>
            ) : (
              // Validation results / Import confirmation
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4">
                {validation.valid ? (
                  <>
                    <p className="text-sm mb-3">
                      Found <strong>{validation.stats.validItems}</strong> bookmarks to import.
                      {validation.stats.duplicateUrls > 0 && (
                        <span className="text-hn-text-secondary">
                          {' '}({validation.stats.duplicateUrls} duplicates in file will be skipped)
                        </span>
                      )}
                    </p>

                    {validation.warnings.length > 0 && (
                      <div className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                        <p className="font-medium mb-1">Warnings:</p>
                        <ul className="list-disc list-inside">
                          {validation.warnings.slice(0, 3).map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                          {validation.warnings.length > 3 && (
                            <li>...and {validation.warnings.length - 3} more</li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2">When URL already exists:</p>
                      <div className="flex gap-4 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="conflictStrategy"
                            value="skip"
                            checked={conflictStrategy === 'skip'}
                            onChange={() => setConflictStrategy('skip')}
                          />
                          Skip (keep existing)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="conflictStrategy"
                            value="merge"
                            checked={conflictStrategy === 'merge'}
                            onChange={() => setConflictStrategy('merge')}
                          />
                          Merge (combine metadata)
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => confirmImport({ conflictStrategy })}
                        disabled={isImporting}
                        size="sm"
                      >
                        {isImporting ? 'Importing...' : 'Import'}
                      </Button>
                      <Button
                        onClick={clearValidation}
                        variant="secondary"
                        size="sm"
                        disabled={isImporting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                      Invalid file:
                    </p>
                    <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside mb-3">
                      {validation.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                      {validation.errors.length > 5 && (
                        <li>...and {validation.errors.length - 5} more errors</li>
                      )}
                    </ul>
                    <Button onClick={clearValidation} variant="secondary" size="sm">
                      Try Another File
                    </Button>
                  </>
                )}
              </div>
            )}
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

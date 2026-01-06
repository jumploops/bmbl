# Plan: Show/Hide Favicons Setting

**Date**: 2026-01-05
**Status**: Proposed
**Priority**: Low

---

## Problem Statement

Users may want to hide favicons in the item list for:
- Cleaner, more minimal appearance (HN-style purist)
- Faster rendering (no external image requests)
- Privacy (favicons can reveal browsing to shoulder-surfers)
- Consistency (many favicons are broken/missing anyway)

Currently, favicons are always shown with a Globe icon fallback when unavailable.

---

## Current Implementation

### Favicon Display (`src/components/ItemRow.tsx:62-74`)

```tsx
{/* Favicon */}
{item.favIconUrl ? (
  <img
    src={item.favIconUrl}
    alt=""
    className="w-4 h-4 shrink-0 mt-0.5"
    onError={(e) => {
      e.currentTarget.style.display = 'none';
    }}
  />
) : (
  <Globe size={14} className="text-hn-text-secondary shrink-0 mt-0.5" />
)}
```

**Behavior**:
- If `favIconUrl` exists: Show the image (hide on error)
- If `favIconUrl` is null: Show Globe icon

### Settings System

**Type definition** (`src/types/index.ts:73-85`):
```typescript
export interface Settings {
  autoCloseAfterSave: boolean;
  resurfaceHiddenOnRecapture: boolean;
  defaultView: ViewType;
  darkMode: DarkMode;
}

export const DEFAULT_SETTINGS: Settings = {
  autoCloseAfterSave: false,
  resurfaceHiddenOnRecapture: false,
  defaultView: 'new',
  darkMode: 'system',
};
```

**Storage**: `chrome.storage.sync` via `src/lib/settings.ts`

**Hook**: `useSettings()` in `src/hooks/useSettings.ts` - returns `{ settings, isLoading, updateSetting }`

### Component Tree (newtab)

```
App
├── useSettings() → settings.darkMode used for theme
├── ViewProvider
│   └── NewTabContent
│       ├── useView() → currentView
│       ├── useItems(currentView) → items, actions
│       └── ItemList
│           └── ItemRow (×N) ← favicon displayed here
```

**Key observation**: `ItemRow` doesn't currently receive any settings. Settings are used at the App level for dark mode only.

---

## Design Options

### Option A: Prop Drilling

Pass `showFavicons` from App → NewTabContent → ItemList → ItemRow.

```tsx
// App.tsx
const { settings } = useSettings();
<NewTabContent showFavicons={settings.showFavicons} />

// NewTabContent → ItemList
<ItemList showFavicons={showFavicons} ... />

// ItemList → ItemRow
<ItemRow showFavicons={showFavicons} ... />

// ItemRow
{showFavicons && (item.favIconUrl ? <img.../> : <Globe.../>)}
```

**Pros**:
- Explicit data flow
- No new abstractions
- Easy to understand

**Cons**:
- Adds prop to 3 components
- If we add more display settings, props multiply

**Complexity**: Low

---

### Option B: Settings Context

Create a SettingsContext that provides settings to the entire tree.

```tsx
// SettingsContext.tsx (new)
const SettingsContext = createContext<Settings>(DEFAULT_SETTINGS);

export function SettingsProvider({ children }) {
  const { settings, isLoading } = useSettings();
  if (isLoading) return <Loading />;
  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettingsContext = () => useContext(SettingsContext);

// ItemRow.tsx
const { showFavicons } = useSettingsContext();
```

**Pros**:
- Any component can access settings
- Scales well if we add more display settings
- No prop drilling

**Cons**:
- New abstraction to maintain
- Overkill for one setting
- Slightly more complex mental model

**Complexity**: Medium

---

### Option C: Direct Hook in ItemRow

Call `useSettings()` directly in ItemRow.

```tsx
// ItemRow.tsx
export function ItemRow({ item, ... }) {
  const { settings } = useSettings();
  // Use settings.showFavicons
}
```

**Pros**:
- Simplest code change
- No prop changes needed

**Cons**:
- Less explicit about dependencies
- Each ItemRow instance calls the hook (though it's the same underlying subscription)
- Mixes data-fetching concern into presentation component

**Complexity**: Low (but not ideal pattern)

---

## Recommendation: Option A (Prop Drilling)

**Rationale**:
1. **Simplicity**: Just one boolean setting, prop drilling is appropriate
2. **Explicitness**: Clear data flow, easy to trace
3. **Performance**: No additional subscriptions or context
4. **Pragmatic**: We can refactor to Context later if we add more display settings

---

## Implementation Plan

### Step 1: Add Setting to Types

**File**: `src/types/index.ts`

```typescript
export interface Settings {
  autoCloseAfterSave: boolean;
  resurfaceHiddenOnRecapture: boolean;
  defaultView: ViewType;
  darkMode: DarkMode;
  showFavicons: boolean;  // NEW
}

export const DEFAULT_SETTINGS: Settings = {
  autoCloseAfterSave: false,
  resurfaceHiddenOnRecapture: false,
  defaultView: 'new',
  darkMode: 'system',
  showFavicons: true,  // NEW - default to showing favicons
};
```

### Step 2: Add Toggle to Options Page

**File**: `src/entrypoints/options/App.tsx`

Add to the "Appearance" section (after Theme):

```tsx
{/* Show favicons setting */}
<div className="flex items-start justify-between py-3 border-t border-gray-100 dark:border-gray-700">
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
```

### Step 3: Pass Setting Through Component Tree

**File**: `src/entrypoints/newtab/App.tsx`

```tsx
function NewTabContent({ showFavicons }: { showFavicons: boolean }) {
  // ... existing code ...
  return (
    <main className="py-2">
      <ItemList
        items={items}
        view={currentView}
        showFavicons={showFavicons}  // NEW
        // ... other props
      />
    </main>
  );
}

export default function App() {
  const { settings } = useSettings();
  useDarkMode(settings.darkMode);

  return (
    <ViewProvider>
      {/* ... */}
      <NewTabContent showFavicons={settings.showFavicons} />  {/* NEW */}
      {/* ... */}
    </ViewProvider>
  );
}
```

**File**: `src/components/ItemList.tsx`

```tsx
interface ItemListProps {
  items: Item[];
  view: ViewType;
  showFavicons: boolean;  // NEW
  // ... other props
}

export function ItemList({
  items,
  view,
  showFavicons,  // NEW
  // ...
}: ItemListProps) {
  return (
    <div className="px-2">
      {items.map((item, index) => (
        <ItemRow
          key={item.itemId}
          item={item}
          rank={startRank + index}
          view={view}
          showFavicons={showFavicons}  // NEW
          // ... other props
        />
      ))}
      {/* ... */}
    </div>
  );
}
```

### Step 4: Conditionally Render Favicon

**File**: `src/components/ItemRow.tsx`

```tsx
interface ItemRowProps {
  item: Item;
  rank: number;
  view: ViewType;
  showFavicons: boolean;  // NEW
  onFavorite: () => void;
  onUnfavorite: () => void;
  onHide: () => void;
  onRestore: () => void;
}

export function ItemRow({
  item,
  rank,
  view,
  showFavicons,  // NEW
  // ...
}: ItemRowProps) {
  // ...
  return (
    <div className="flex items-start gap-1 py-1">
      {/* ... rank, vote arrow ... */}

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1">
          {/* Favicon - only show if enabled */}
          {showFavicons && (
            item.favIconUrl ? (
              <img
                src={item.favIconUrl}
                alt=""
                className="w-4 h-4 shrink-0 mt-0.5"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <Globe size={14} className="text-hn-text-secondary shrink-0 mt-0.5" />
            )
          )}

          {/* Title + Domain wrapper */}
          <div>
            {/* ... title, domain ... */}
          </div>
        </div>
        {/* ... metadata ... */}
      </div>
    </div>
  );
}
```

### Step 5: Verify

1. Run `pnpm typecheck`
2. Run `pnpm build`
3. Manual testing:
   - Toggle setting in Options
   - Verify favicons show/hide in newtab
   - Verify setting persists across page refresh
   - Test both states: with favicons, without favicons

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `showFavicons` to Settings interface and DEFAULT_SETTINGS |
| `src/entrypoints/options/App.tsx` | Add toggle in Appearance section |
| `src/entrypoints/newtab/App.tsx` | Pass `showFavicons` to NewTabContent |
| `src/components/ItemList.tsx` | Add `showFavicons` prop, pass to ItemRow |
| `src/components/ItemRow.tsx` | Add `showFavicons` prop, conditionally render favicon |

---

## Edge Cases

1. **Setting loads after items**: `useSettings` handles loading state; items render with default (true) until settings load, then re-render. Brief flash possible but acceptable.

2. **Setting changed while viewing**: `chrome.storage.sync.onChanged` triggers `onSettingsChange`, which updates state, causing re-render. Works automatically.

3. **Favicon with no fallback**: When `showFavicons=false`, neither image nor Globe icon shows. This is intentional - creates cleaner look.

---

## Future Considerations

- If we add more display settings (font size, compact mode, etc.), consider:
  - Creating a `DisplaySettings` subset
  - Moving to Context pattern (Option B)
  - Grouping in a "Display" section on Options page

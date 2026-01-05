# Codebase Audit: bmbl v0.0.1

**Date**: 2026-01-05
**Last Updated**: 2026-01-05
**Scope**: Full codebase review
**Focus Areas**: Security, Performance, Abstractions, Simplicity/Robustness

---

## Executive Summary

The bmbl codebase is well-structured for a Chrome extension prototype. The code follows good separation of concerns, uses TypeScript effectively, and has sensible React patterns. Several issues have been addressed, with some remaining items to tackle:

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | 0 | 0 | 2 | 2 |
| Performance | 0 | ~~2~~ 0 ✅ | 2 | 1 |
| Abstractions | 0 | 0 | 2 | 3 |
| Robustness | 0 | 1 | 3 | 2 |

### Resolved Issues
- ✅ **Performance H1**: `listItems` now uses compound indexes (was `listItemsV2`)
- ✅ **Performance H2**: `getActiveItemCount` uses indexed queries (replaced `getItemCount`)

---

## 1. Security Analysis

### 1.1 Strengths

**URL Validation** (`src/lib/utils/url.ts:4-13`)
- `isCapturableUrl()` correctly restricts capture to http/https URLs
- Prevents capture of sensitive `chrome://`, `file://`, `chrome-extension://` URLs
- Good use of try/catch for malformed URLs

**No External Network Calls**
- All data stays local (IndexedDB via Dexie, chrome.storage.sync)
- No telemetry, analytics, or external API calls
- User data never leaves the browser

**Secure ID Generation** (`src/lib/utils/uuid.ts`)
- Uses `crypto.randomUUID()` which is cryptographically secure
- Avoids collision issues with sequential IDs

**XSS Prevention**
- React's JSX escaping handles user-provided content (titles, URLs)
- External links use `rel="noopener noreferrer"` to prevent tabnapping

### 1.2 Medium Priority Issues

**M1: Favicon URLs Rendered Without Validation** (`src/components/ItemRow.tsx:62-70`)

```tsx
{item.favIconUrl ? (
  <img
    src={item.favIconUrl}
    alt=""
    className="w-4 h-4 shrink-0 mt-0.5"
    onError={(e) => {
      e.currentTarget.style.display = 'none';
    }}
  />
) : ...
```

The favicon URL from Chrome's tab API is stored and rendered directly. While Chrome controls favicon URLs, this is a potential attack surface:
- Malicious extensions could potentially inject data URLs
- Large data URLs could impact memory

**Recommendation**: Validate favicon URLs are http/https or data:image/* with size limits.

**M2: Console Logging in Production** (`src/entrypoints/background.ts`)

```ts
console.log('bmbl background script loaded');
console.log('Toolbar icon clicked');
console.log('Capture complete:', result);
```

Debug logging in production builds could leak operational details.

**Recommendation**: Use a logging utility that strips logs in production builds, or remove before release.

### 1.3 Low Priority Issues

**L1: No Title Length Validation**
Excessively long titles from tabs are stored and displayed as-is. While not a security vulnerability, this could cause layout issues or memory bloat with adversarial input.

**L2: No Rate Limiting on Message Handler**
The `chrome.runtime.onMessage` handler has no rate limiting. The `captureInProgress` guard helps but isn't comprehensive protection against rapid message spam.

---

## 2. Performance Analysis

### 2.1 Strengths

**Atomic Database Operations** (`src/lib/capture/capture.ts:66-114`)
- Uses Dexie transactions for capture operations
- Prevents partial state on errors

**Pagination** (`src/hooks/useItems.ts`)
- Items loaded in pages of 30
- Intersection observer for efficient infinite scroll

**Optimistic Updates** (`src/hooks/useItems.ts:84-148`)
- UI updates immediately
- Reverts on error for good UX

**Parallel Data Fetching** (`src/lib/capture/capture.ts:45-48`)
```ts
const [allTabs, allGroups] = await Promise.all([
  queryAllTabs(),
  queryAllTabGroups(),
]);
```

### 2.2 High Priority Issues

**✅ RESOLVED: H1 & H2 - Database Query Performance**

*Fixed in schema v5 (2026-01-05). See `plan/006-listItems-performance.md` for details.*

The original issues were:
- `listItemsV2` loaded all items into memory before filtering/sorting
- `getItemCount` loaded all items just to count non-deleted ones

**Solution implemented**:
1. Added sentinel values (`NOT_DELETED = 0`, `NOT_FAVORITED = 0`) instead of `null` to enable indexed queries
2. Added compound indexes: `[deletedAt+lastSavedAt]`, `[deletedAt+favoritedAt]`, `[deletedAt+saveCount]`
3. Rewrote `listItems()` with view-specific optimized queries using compound indexes
4. Replaced `getItemCount()` with `getActiveItemCount()` and `getTotalItemCount()` using indexed counts

**New query pattern** (`src/lib/db/items.ts`):
```ts
// Example: 'new' view - uses compound index for O(log n + k) performance
db.items
  .where('[deletedAt+lastSavedAt]')
  .between([NOT_DELETED, Dexie.minKey], [NOT_DELETED, Dexie.maxKey])
  .reverse()
  .offset(offset)
  .limit(limit)
  .toArray()
```

### 2.3 Medium Priority Issues

**M1: Settings Loaded Multiple Times**

Settings are loaded independently by:
- `ViewContext.tsx` (to get `defaultView`)
- `App.tsx` in newtab (to get `darkMode`)
- `App.tsx` in options (to get all settings)

Each creates separate `chrome.storage.sync.get` calls.

**Recommendation**: Create a `SettingsProvider` context that loads once and shares.

**M2: Service Worker Icon Timeout** (`src/lib/capture/icons.ts:41-46`)

```ts
if (state === 'success') {
  successTimeout = setTimeout(() => {
    chrome.action.setIcon({ path: ICON_PATHS.default });
    successTimeout = null;
  }, 5000);
}
```

In Manifest V3, service workers can be terminated while this timeout is pending, causing the icon to stay in "success" state indefinitely.

**Recommendation**: Use `chrome.alarms` API instead of `setTimeout` for reliable timing in service workers.

### 2.4 Low Priority Issues

**L1: Media Query Listener Setup**

`useDarkMode` creates event listeners that could be optimized with `useSyncExternalStore` for React 18's concurrent features.

---

## 3. Abstraction Analysis

### 3.1 Strengths

**Clean Module Structure**
```
src/
├── entrypoints/     # WXT entry points
├── components/      # React components
├── contexts/        # React contexts
├── hooks/           # Custom hooks
├── lib/
│   ├── db/          # Database layer
│   ├── capture/     # Capture logic
│   └── utils/       # Utilities
└── types/           # TypeScript types
```

**Dexie Schema Versioning** (`src/lib/db/schema.ts`)
- Proper migration path from v1 to v4
- Each version documents the change
- Upgrade functions handle data transformation

**Type Definitions** (`src/types/index.ts`)
- Comprehensive types for all entities
- Clear separation: DB entities, views, settings, messages
- Default values co-located with types

### 3.2 Medium Priority Issues

**M1: Message Type Union Incomplete** (`src/types/index.ts:150-152`)

```ts
export type Message = CaptureMessage | GetLastCaptureMessage;
// Missing: CaptureResultMessage
```

`CaptureResultMessage` is defined but not included in the `Message` union.

**M2: Duplicate Settings Loading**

Both `ViewContext` and the parent `App` component load settings. The `ViewContext` only needs `defaultView`, while `App` needs `darkMode`. This creates:
- Two network calls on page load
- Potential race conditions if settings change

**Recommendation**: Lift settings loading to a single provider above both consumers.

### 3.3 Low Priority Issues

**L1: Unused Parameter in `filterAndTransformTabs`** (`src/lib/capture/tabs.ts:44`)

```ts
export function filterAndTransformTabs(
  tabs: chrome.tabs.Tab[],
  _groupMap: Map<number, TabGroupInfo>  // <-- underscore prefix but parameter exists
): { ... }
```

The `_groupMap` parameter is passed in but not used. Either remove it or use it.

**L2: Inconsistent Return Types**

Some functions return `Promise<void>` (like `softDelete`), while similar operations return the updated entity. Consider consistency.

**L3: `onSettingsChange` Naming**

The function returns an unsubscribe callback, but the name implies it's only called on change. Consider `subscribeToSettings` or similar.

---

## 4. Robustness Analysis

### 4.1 Strengths

**Soft Delete Pattern** (`src/lib/db/items.ts:174-189`)
- Items are never permanently deleted
- `deletedAt` timestamp enables recovery
- Clean restore function

**Error Boundaries in Hooks**
- All async operations wrapped in try/catch
- Error states exposed to components
- Optimistic updates revert on failure

**Capture Guard** (`src/lib/capture/capture.ts:17-33`)
```ts
let captureInProgress = false;

export function isCaptureInProgress(): boolean {
  return captureInProgress;
}

export async function captureAllTabs(): Promise<CaptureResult> {
  if (captureInProgress) {
    throw new Error('Capture already in progress');
  }
  captureInProgress = true;
  try { ... }
  finally { captureInProgress = false; }
}
```

### 4.2 High Priority Issues

**H1: Stale Closure in `unfavorite`** (`src/hooks/useItems.ts:105-126`)

```ts
const unfavorite = useCallback(async (itemId: string) => {
  // Store original value for revert
  const originalFavoritedAt = items.find(i => i.itemId === itemId)?.favoritedAt;
  // ...
}, [items]);  // <-- items in dependency array
```

This callback depends on `items`, but `items` changes frequently. This can cause:
- Stale data if items update between click and execution
- Unnecessary re-renders of components using this callback

**Recommendation**: Access current state via callback form:
```ts
const unfavorite = useCallback(async (itemId: string) => {
  let originalFavoritedAt: number | null = null;
  setItems((prev) => {
    originalFavoritedAt = prev.find(i => i.itemId === itemId)?.favoritedAt ?? null;
    return prev.map((item) =>
      item.itemId === itemId ? { ...item, favoritedAt: null } : item
    );
  });
  // ... rest of logic
}, []);
```

### 4.3 Medium Priority Issues

**M1: Generic Error Messages**

Error messages are often generic:
- "Failed to load items"
- "Failed to refresh"
- "Capture failed"

These don't help users understand or report issues.

**Recommendation**: Preserve and display actual error messages, at least in development.

**M2: No Timeout on Settings Load** (`src/entrypoints/options/App.tsx:24-30`)

```tsx
if (isLoading) {
  return (
    <div className="...">
      <p className="text-hn-text-secondary">Loading settings...</p>
    </div>
  );
}
```

No timeout or retry mechanism. If `chrome.storage.sync` fails, user sees loading forever.

**M3: `useLastCapture` Error Silently Logged** (`src/hooks/useLastCapture.ts:12-14`)

```ts
.catch((error) => {
  console.error('Failed to get last capture:', error);
});
```

Errors are only logged, not exposed to UI. User has no indication if last capture data failed to load.

### 4.4 Low Priority Issues

**L1: No Debouncing on Settings Updates**

Rapid toggle clicks could cause multiple `chrome.storage.sync.set` calls.

**L2: Non-null Assertion in main.tsx** (`src/entrypoints/*/main.tsx:6`)

```ts
ReactDOM.createRoot(document.getElementById('root')!).render(...)
```

The `!` assertion could cause silent failures if root element is missing.

---

## 5. Recommendations Summary

### Immediate (Before Public Release)

1. ~~**Refactor `listItemsV2`** to use indexed queries instead of loading all items~~ ✅ Done
2. **Fix stale closure** in `useItems.unfavorite` ⬅️ **Next priority**
3. **Replace `setTimeout`** with `chrome.alarms` for icon state in service worker
4. **Remove or conditionally disable** console.log statements

### Short-term

5. **Add favicon URL validation** before rendering
6. **Create unified SettingsProvider** to avoid duplicate loading
7. **Improve error messages** with more context
8. **Add loading timeouts** with retry mechanisms

### Nice-to-have

9. Fix unused `_groupMap` parameter
10. Complete `Message` type union
11. Add input length validation for titles
12. Consider debouncing settings updates

---

## 6. Code Quality Metrics

### Files Reviewed: 35

| Category | Files | Lines |
|----------|-------|-------|
| Types | 1 | 153 |
| Database | 4 | 308 |
| Capture | 4 | 191 |
| Utils | 5 | 122 |
| Hooks | 6 | 207 |
| Components | 8 | 257 |
| Contexts | 1 | 46 |
| Entry points | 3 | 100 |
| Config | 3 | ~70 |

### Test Coverage

Current tests: `src/lib/utils/url.test.ts` only (96 lines)
- Good coverage of URL utilities
- No tests for database operations, hooks, or components

**Recommendation**: Add tests for:
- Database operations (using in-memory Dexie)
- Hook behavior (using testing-library/react-hooks)
- Component rendering (using testing-library/react)

---

## Appendix: File Reference

| File | Primary Concern | Priority | Status |
|------|-----------------|----------|--------|
| `src/lib/db/items.ts` | ~~Performance (H1, H2)~~ | ~~High~~ | ✅ Fixed |
| `src/hooks/useItems.ts` | Robustness (H1) | High | Open |
| `src/lib/capture/icons.ts` | Performance (M2) | Medium | Open |
| `src/components/ItemRow.tsx` | Security (M1) | Medium | Open |
| `src/entrypoints/background.ts` | Security (M2) | Medium | Open |
| `src/contexts/ViewContext.tsx` | Abstractions (M2) | Medium | Open |
| `src/lib/capture/tabs.ts` | Abstractions (L1) | Low | Open |
| `src/types/index.ts` | Abstractions (M1) | Low | Open |

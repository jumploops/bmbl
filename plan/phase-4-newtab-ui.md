# Phase 4: New Tab UI

**Goal**: Build the complete Hacker News-style new tab page with item list, views/sorting, score controls, hide/restore actions, pagination, and all UI states.

**Dependencies**: Phase 1 (Project Setup), Phase 2 (Data Layer), Phase 3 (Capture Pipeline)

**Estimated scope**: Large

---

## Overview

This phase implements:
- HN-style header with navigation
- Item list component with all metadata
- Five views: new, old, priority, frequent, hidden
- Score controls (upvote/downvote)
- Hide and restore actions
- Infinite scroll pagination
- Empty state with capture button
- Loading state with skeleton
- Error state
- Relative time formatting

---

## Implementation Steps

### 1. Time Utilities

**src/lib/utils/time.ts**
```ts
import { formatDistanceToNow } from 'date-fns';

/**
 * Format a timestamp as relative time ("2h ago")
 */
export function formatRelativeTime(timestamp: number): string {
  return formatDistanceToNow(timestamp, { addSuffix: true });
}

/**
 * Format a timestamp as absolute date for tooltip
 */
export function formatAbsoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}
```

### 2. View Context

**src/contexts/ViewContext.tsx**
```tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ViewType } from '@/types';

interface ViewContextValue {
  currentView: ViewType;
  setView: (view: ViewType) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

export function ViewProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentView] = useState<ViewType>('new');

  const setView = useCallback((view: ViewType) => {
    setCurrentView(view);
  }, []);

  return (
    <ViewContext.Provider value={{ currentView, setView }}>
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

### 3. Items Hook

**src/hooks/useItems.ts**
```tsx
import { useState, useEffect, useCallback } from 'react';
import { listItemsV2, incrementScore, decrementScore, softDelete, restore } from '@/lib/db/items';
import type { Item, ViewType } from '@/types';

const PAGE_SIZE = 30;

interface UseItemsReturn {
  items: Item[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  upvote: (itemId: string) => Promise<void>;
  downvote: (itemId: string) => Promise<void>;
  hide: (itemId: string) => Promise<void>;
  unhide: (itemId: string) => Promise<void>;
}

export function useItems(view: ViewType): UseItemsReturn {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Initial load
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setIsLoading(true);
    setError(null);

    listItemsV2({ view, limit: PAGE_SIZE, offset: 0 })
      .then((loadedItems) => {
        setItems(loadedItems);
        setHasMore(loadedItems.length === PAGE_SIZE);
        setOffset(PAGE_SIZE);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load items');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [view]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const moreItems = await listItemsV2({ view, limit: PAGE_SIZE, offset });
      setItems((prev) => [...prev, ...moreItems]);
      setHasMore(moreItems.length === PAGE_SIZE);
      setOffset((prev) => prev + PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more items');
    } finally {
      setIsLoading(false);
    }
  }, [view, offset, isLoading, hasMore]);

  const refresh = useCallback(async () => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setIsLoading(true);
    setError(null);

    try {
      const loadedItems = await listItemsV2({ view, limit: PAGE_SIZE, offset: 0 });
      setItems(loadedItems);
      setHasMore(loadedItems.length === PAGE_SIZE);
      setOffset(PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setIsLoading(false);
    }
  }, [view]);

  const upvote = useCallback(async (itemId: string) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, score: item.score + 1 } : item
      )
    );

    try {
      await incrementScore(itemId);
    } catch {
      // Revert on error
      setItems((prev) =>
        prev.map((item) =>
          item.itemId === itemId ? { ...item, score: item.score - 1 } : item
        )
      );
    }
  }, []);

  const downvote = useCallback(async (itemId: string) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId
          ? { ...item, score: Math.max(0, item.score - 1) }
          : item
      )
    );

    try {
      await decrementScore(itemId);
    } catch {
      // Revert on error (would need to track original score)
      await refresh();
    }
  }, [refresh]);

  const hide = useCallback(async (itemId: string) => {
    // Optimistic update - remove from list
    setItems((prev) => prev.filter((item) => item.itemId !== itemId));

    try {
      await softDelete(itemId);
    } catch {
      await refresh();
    }
  }, [refresh]);

  const unhide = useCallback(async (itemId: string) => {
    // Optimistic update - remove from hidden list
    setItems((prev) => prev.filter((item) => item.itemId !== itemId));

    try {
      await restore(itemId);
    } catch {
      await refresh();
    }
  }, [refresh]);

  return {
    items,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    upvote,
    downvote,
    hide,
    unhide,
  };
}
```

### 4. Header Component

**src/components/Header.tsx**
```tsx
import { cn } from '@/lib/utils/cn';
import { useView } from '@/contexts/ViewContext';
import type { ViewType } from '@/types';

const NAV_ITEMS: { view: ViewType; label: string }[] = [
  { view: 'new', label: 'new' },
  { view: 'old', label: 'old' },
  { view: 'priority', label: 'priority' },
  { view: 'frequent', label: 'frequent' },
  { view: 'hidden', label: 'hidden' },
];

export function Header() {
  const { currentView, setView } = useView();

  return (
    <header className="bg-hn-header text-white">
      <nav className="flex items-center gap-1 px-2 py-0.5 text-[10pt]">
        <span className="font-bold mr-1">bmbl</span>

        {NAV_ITEMS.map((item, index) => (
          <span key={item.view} className="flex items-center">
            {index > 0 && <span className="mx-1">|</span>}
            <button
              onClick={() => setView(item.view)}
              className={cn(
                'hover:underline',
                currentView === item.view && 'font-bold'
              )}
            >
              {item.label}
            </button>
          </span>
        ))}

        <span className="mx-1">|</span>
        <a
          href={chrome.runtime.getURL('options.html')}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          settings
        </a>
      </nav>
    </header>
  );
}
```

### 5. Item Row Component

**src/components/ItemRow.tsx**
```tsx
import { Globe, ChevronUp, ChevronDown, Trash2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatRelativeTime, formatAbsoluteTime } from '@/lib/utils/time';
import type { Item, ViewType } from '@/types';

interface ItemRowProps {
  item: Item;
  rank: number;
  view: ViewType;
  onUpvote: () => void;
  onDownvote: () => void;
  onHide: () => void;
  onRestore: () => void;
}

export function ItemRow({
  item,
  rank,
  view,
  onUpvote,
  onDownvote,
  onHide,
  onRestore,
}: ItemRowProps) {
  const isHiddenView = view === 'hidden';

  return (
    <div className="flex items-start gap-1 py-1">
      {/* Rank */}
      <span className="text-hn-text-secondary w-8 text-right shrink-0">
        {rank}.
      </span>

      {/* Vote buttons */}
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <button
          onClick={onUpvote}
          className="text-hn-text-secondary hover:text-hn-text p-0 leading-none"
          title="Upvote"
        >
          <ChevronUp size={12} strokeWidth={3} />
        </button>
        {!isHiddenView && (
          <button
            onClick={onDownvote}
            className="text-hn-text-secondary hover:text-hn-text p-0 leading-none"
            title="Downvote"
          >
            <ChevronDown size={12} strokeWidth={3} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Line 1: Title + Domain */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Favicon */}
          {item.favIconUrl ? (
            <img
              src={item.favIconUrl}
              alt=""
              className="w-4 h-4 shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <Globe size={14} className="text-hn-text-secondary shrink-0" />
          )}

          {/* Title */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-hn-link hover:underline break-words"
            title={item.url}
          >
            {item.title}
          </a>

          {/* Domain */}
          <span className="text-hn-text-secondary text-[8pt]">
            ({item.domain})
          </span>
        </div>

        {/* Line 2: Metadata + Actions */}
        <div className="text-[8pt] text-hn-text-secondary flex items-center gap-2 mt-0.5">
          <span>{item.score} point{item.score !== 1 ? 's' : ''}</span>

          <span title={formatAbsoluteTime(item.lastSavedAt)}>
            saved {formatRelativeTime(item.lastSavedAt)}
          </span>

          {(view === 'frequent' || item.saveCount > 1) && (
            <span>({item.saveCount}x)</span>
          )}

          {/* Actions */}
          {isHiddenView ? (
            <button
              onClick={onRestore}
              className="hover:underline flex items-center gap-0.5"
            >
              <RotateCcw size={10} />
              restore
            </button>
          ) : (
            <button
              onClick={onHide}
              className="hover:underline flex items-center gap-0.5"
            >
              <Trash2 size={10} />
              hide
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 6. Item List Component

**src/components/ItemList.tsx**
```tsx
import { useEffect, useRef, useCallback } from 'react';
import { ItemRow } from './ItemRow';
import { ItemSkeleton } from './ItemSkeleton';
import type { Item, ViewType } from '@/types';

interface ItemListProps {
  items: Item[];
  view: ViewType;
  isLoading: boolean;
  hasMore: boolean;
  startRank?: number;
  onLoadMore: () => void;
  onUpvote: (itemId: string) => void;
  onDownvote: (itemId: string) => void;
  onHide: (itemId: string) => void;
  onRestore: (itemId: string) => void;
}

export function ItemList({
  items,
  view,
  isLoading,
  hasMore,
  startRank = 1,
  onLoadMore,
  onUpvote,
  onDownvote,
  onHide,
  onRestore,
}: ItemListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  return (
    <div className="px-2">
      {items.map((item, index) => (
        <ItemRow
          key={item.itemId}
          item={item}
          rank={startRank + index}
          view={view}
          onUpvote={() => onUpvote(item.itemId)}
          onDownvote={() => onDownvote(item.itemId)}
          onHide={() => onHide(item.itemId)}
          onRestore={() => onRestore(item.itemId)}
        />
      ))}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-4" />

      {/* Loading indicator */}
      {isLoading && items.length > 0 && (
        <div className="py-2">
          <ItemSkeleton count={3} />
        </div>
      )}
    </div>
  );
}
```

### 7. Skeleton Component

**src/components/ItemSkeleton.tsx**
```tsx
interface ItemSkeletonProps {
  count?: number;
}

export function ItemSkeleton({ count = 5 }: ItemSkeletonProps) {
  return (
    <div className="px-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-1 py-1 animate-pulse">
          {/* Rank */}
          <div className="w-8 h-4 bg-gray-200 rounded" />

          {/* Vote placeholder */}
          <div className="w-3 h-6 bg-gray-200 rounded" />

          {/* Content */}
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 8. Empty State Component

**src/components/EmptyState.tsx**
```tsx
import { useCapture } from '@/hooks/useCapture';

export function EmptyState() {
  const { capture, isCapturing } = useCapture();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <h2 className="text-lg font-bold mb-2">No saved tabs yet.</h2>

      <p className="text-hn-text-secondary mb-6 text-center max-w-md">
        Click once to save all tabs into a reading backlog.
        Your bookmarks will appear here, sorted and ready to triage.
      </p>

      <button
        onClick={() => capture()}
        disabled={isCapturing}
        className="bg-hn-header text-white px-4 py-2 rounded hover:bg-hn-header-dark disabled:opacity-50"
      >
        {isCapturing ? 'Saving...' : 'Save all open tabs'}
      </button>
    </div>
  );
}
```

### 9. Error State Component

**src/components/ErrorState.tsx**
```tsx
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded p-4 m-4">
      <p className="text-red-800 mb-2">
        Something went wrong loading your backlog.
      </p>
      <p className="text-red-600 text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-red-800 underline hover:no-underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
```

### 10. Main App Component

**src/entrypoints/newtab/App.tsx**
```tsx
import { ViewProvider, useView } from '@/contexts/ViewContext';
import { Header } from '@/components/Header';
import { ItemList } from '@/components/ItemList';
import { ItemSkeleton } from '@/components/ItemSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useItems } from '@/hooks/useItems';

function NewTabContent() {
  const { currentView } = useView();
  const {
    items,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    upvote,
    downvote,
    hide,
    unhide,
  } = useItems(currentView);

  // Error state
  if (error && items.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  // Loading state (initial load)
  if (isLoading && items.length === 0) {
    return (
      <main className="py-2">
        <ItemSkeleton count={10} />
      </main>
    );
  }

  // Empty state
  if (!isLoading && items.length === 0) {
    return <EmptyState />;
  }

  // Loaded state
  return (
    <main className="py-2">
      <ItemList
        items={items}
        view={currentView}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onUpvote={upvote}
        onDownvote={downvote}
        onHide={hide}
        onRestore={unhide}
      />
    </main>
  );
}

export default function App() {
  return (
    <ViewProvider>
      <div className="min-h-screen bg-hn-bg font-hn text-[10pt]">
        <Header />
        <NewTabContent />
      </div>
    </ViewProvider>
  );
}
```

### 11. Dark Mode Support

**src/hooks/useDarkMode.ts**
```tsx
import { useState, useEffect } from 'react';

export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return isDark;
}
```

Update **src/entrypoints/newtab/App.tsx** to use dark mode:
```tsx
import { useDarkMode } from '@/hooks/useDarkMode';

export default function App() {
  useDarkMode(); // Apply dark mode class to html

  return (
    <ViewProvider>
      {/* ... */}
    </ViewProvider>
  );
}
```

### 12. Update Tailwind for Dark Mode

Ensure **tailwind.config.js** has dark mode colors:
```js
theme: {
  extend: {
    colors: {
      // Light mode
      'hn-bg': '#f6f6ef',
      'hn-header': '#7c3aed',
      'hn-header-dark': '#5b21b6',
      'hn-text': '#000000',
      'hn-text-secondary': '#828282',

      // Dark mode variants (use with dark: prefix)
      'hn-bg-dark': '#1a1a1a',
      'hn-text-dark': '#e5e5e5',
      'hn-text-secondary-dark': '#a0a0a0',
    },
  },
},
```

Update **src/styles/globals.css**:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #f6f6ef;
  --text: #000000;
  --text-secondary: #828282;
}

.dark {
  --bg: #1a1a1a;
  --text: #e5e5e5;
  --text-secondary: #a0a0a0;
}

body {
  font-family: Verdana, Geneva, sans-serif;
  font-size: 10pt;
  background: var(--bg);
  color: var(--text);
}
```

---

## Files to Create/Update

| File | Purpose |
|------|---------|
| `src/lib/utils/time.ts` | Time formatting utilities |
| `src/contexts/ViewContext.tsx` | View state management |
| `src/hooks/useItems.ts` | Items data hook |
| `src/hooks/useDarkMode.ts` | Dark mode detection |
| `src/components/Header.tsx` | Navigation header |
| `src/components/ItemRow.tsx` | Single item row |
| `src/components/ItemList.tsx` | Item list with infinite scroll |
| `src/components/ItemSkeleton.tsx` | Loading skeleton |
| `src/components/EmptyState.tsx` | Empty state UI |
| `src/components/ErrorState.tsx` | Error state UI |
| `src/entrypoints/newtab/App.tsx` | Main app (update) |
| `src/styles/globals.css` | Dark mode styles (update) |
| `tailwind.config.js` | Dark colors (update) |

---

## Acceptance Criteria

- [ ] Header shows all navigation links
- [ ] Clicking nav links switches views
- [ ] Current view is visually indicated (bold)
- [ ] Settings link opens options page
- [ ] Items display with correct layout (rank, favicon, title, domain, metadata)
- [ ] Favicon falls back to Globe icon on error
- [ ] Relative time shows correctly ("2h ago")
- [ ] Score displays correctly ("X points")
- [ ] Upvote increments score (optimistic)
- [ ] Downvote decrements score (min 0, optimistic)
- [ ] Hide removes item from list (optimistic)
- [ ] Restore brings item back (in hidden view)
- [ ] Infinite scroll loads more items
- [ ] Empty state shows capture button
- [ ] Capture button works in empty state
- [ ] Loading state shows skeleton
- [ ] Error state shows message with retry
- [ ] Dark mode applies based on system preference
- [ ] All views work: new, old, priority, frequent, hidden

---

## Testing

### Manual Testing Checklist

1. **Navigation**
   - Click each nav link → view changes
   - Current view is bold
   - Settings opens new tab with options page

2. **Item Display**
   - Items show rank, favicon, title, domain
   - Long titles wrap correctly
   - Relative time is accurate

3. **Actions**
   - Upvote → score increases immediately
   - Downvote → score decreases (never below 0)
   - Hide → item disappears, appears in hidden
   - Restore (in hidden) → item returns

4. **Pagination**
   - Scroll to bottom → more items load
   - Load indicator appears during load

5. **Empty State**
   - With no items, empty state shows
   - Capture button works

6. **Dark Mode**
   - Toggle system dark mode
   - Colors update appropriately

7. **Error Handling**
   - Simulate DB error → error state shows
   - Retry button works

---

## Notes

- Optimistic UI updates for instant feel; reverts on error
- Intersection Observer for efficient infinite scroll
- date-fns for reliable time formatting
- ViewContext avoids prop drilling for view state
- Dark mode uses system preference (no toggle yet)

---

## Next Phase

Once this phase is complete, proceed to **Phase 5: Polish & Settings** to add the options page, undo toast, and final polish.

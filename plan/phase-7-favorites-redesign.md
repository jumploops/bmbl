# Phase 7: Favorites Redesign

**Goal**: Replace the numeric score system with a simpler favorites model where points represent automatic relevance (saveCount) and favoriting is a boolean toggle with HN-style arrow behavior.

**Dependencies**: Phases 1-6 (existing implementation)

**Related Documents**:
- `spec/favorites-redesign.md` - Full specification

---

## Overview

This phase implements:
- Data model change: `score: number` → `favoritedAt: number | null`
- UI change: Upvote/downvote → HN-style triangle (visible when not favorited, hidden when favorited)
- Points display: Shows `saveCount` instead of `score`
- View rename: "priority" → "favorites"
- New actions: `favorite` / `unfavorite` replace `upvote` / `downvote`

---

## Summary of File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/types/index.ts` | Modify | Update `Item`, `ViewType`, `Settings` |
| `src/lib/db/schema.ts` | Modify | Add v4 migration |
| `src/lib/db/items.ts` | Modify | Remove score functions, add favorite functions, update listItemsV2 |
| `src/hooks/useItems.ts` | Modify | Replace upvote/downvote with favorite/unfavorite |
| `src/components/ItemRow.tsx` | Modify | New arrow UI, points shows saveCount, add unfavorite link |
| `src/components/ItemList.tsx` | Modify | Update props passed to ItemRow |
| `src/components/Header.tsx` | Modify | Rename "priority" to "favorites" |
| `src/styles/globals.css` | Modify | Add votearrow styles |
| `src/contexts/ViewContext.tsx` | Modify | Update default if needed |

---

## Implementation Steps

### Step 1: Update TypeScript Types

**File**: `src/types/index.ts`

#### 1.1 Update Item Interface

```typescript
// Before
export interface Item {
  itemId: string;
  url: string;
  normalizedUrl: string;
  title: string;
  domain: string;
  favIconUrl: string | null;
  createdAt: number;
  lastSavedAt: number;
  saveCount: number;
  score: number;              // REMOVE
  deletedAt: number | null;
  lastOpenedAt: number | null;
  updatedAt: number;
}

// After
export interface Item {
  itemId: string;
  url: string;
  normalizedUrl: string;
  title: string;
  domain: string;
  favIconUrl: string | null;
  createdAt: number;
  lastSavedAt: number;
  saveCount: number;
  favoritedAt: number | null; // NEW: timestamp when favorited, null if not
  deletedAt: number | null;
  lastOpenedAt: number | null;
  updatedAt: number;
}
```

#### 1.2 Update ViewType

```typescript
// Before
export type ViewType = 'new' | 'old' | 'priority' | 'frequent' | 'hidden';

// After
export type ViewType = 'new' | 'old' | 'favorites' | 'frequent' | 'hidden';
```

#### 1.3 Update DEFAULT_SETTINGS

```typescript
// Before
export const DEFAULT_SETTINGS: Settings = {
  autoCloseAfterSave: false,
  resurfaceHiddenOnRecapture: false,
  defaultView: 'new',
};

// After (no change needed if defaultView is 'new')
// But if someone had 'priority', migration will handle it
```

---

### Step 2: Database Schema Migration

**File**: `src/lib/db/schema.ts`

#### 2.1 Add Version 4 Migration

```typescript
// Version 4: Replace score with favoritedAt
this.version(4)
  .stores({
    items: 'itemId, &normalizedUrl, lastSavedAt, saveCount, favoritedAt, deletedAt, updatedAt',
    captures: 'captureId, createdAt',
    captureEvents: '[captureId+itemId], captureId, itemId, capturedAt, groupTitle',
  })
  .upgrade((tx) => {
    return tx
      .table('items')
      .toCollection()
      .modify((item: Record<string, unknown>) => {
        // Convert score > 0 to favorited (use updatedAt as favoritedAt)
        if (item.score && (item.score as number) > 0) {
          item.favoritedAt = item.updatedAt || Date.now();
        } else {
          item.favoritedAt = null;
        }
        // Remove score field
        delete item.score;
      });
  });
```

**Note**: Also need to update the index from `score` to `favoritedAt` in the stores definition.

---

### Step 3: Update Items DAL

**File**: `src/lib/db/items.ts`

#### 3.1 Update createItemFromTab

```typescript
// Before
export function createItemFromTab(
  url: string,
  title: string | null,
  favIconUrl: string | null,
  tabCount: number = 1
): Omit<Item, 'itemId'> {
  // ...
  return {
    // ...
    saveCount: tabCount,
    score: 1, // REMOVE THIS LINE
    // ...
  };
}

// After
export function createItemFromTab(
  url: string,
  title: string | null,
  favIconUrl: string | null,
  tabCount: number = 1
): Omit<Item, 'itemId'> {
  // ...
  return {
    // ...
    saveCount: tabCount,
    favoritedAt: null, // NEW: not favorited by default
    // ...
  };
}
```

#### 3.2 Remove Score Functions

Delete these functions:
- `incrementScore(itemId: string)`
- `decrementScore(itemId: string)`
- `setScore(itemId: string, score: number)`

#### 3.3 Add Favorite Functions

```typescript
/**
 * Add item to favorites
 */
export async function setFavorite(itemId: string): Promise<void> {
  await db.items.update(itemId, {
    favoritedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Remove item from favorites
 */
export async function unsetFavorite(itemId: string): Promise<void> {
  await db.items.update(itemId, {
    favoritedAt: null,
    updatedAt: Date.now(),
  });
}
```

#### 3.4 Update listItemsV2

```typescript
// Update the filter section
switch (view) {
  case 'new':
  case 'old':
  case 'frequent':
    items = items.filter(item => item.deletedAt === null);
    break;
  case 'favorites':  // RENAMED from 'priority'
    items = items.filter(item => item.deletedAt === null && item.favoritedAt !== null);
    break;
  case 'hidden':
    items = items.filter(item => item.deletedAt !== null);
    break;
}

// Update the sort section
switch (view) {
  case 'new':
    items.sort((a, b) => b.lastSavedAt - a.lastSavedAt);
    break;
  case 'old':
    items.sort((a, b) => a.lastSavedAt - b.lastSavedAt);
    break;
  case 'favorites':  // RENAMED from 'priority'
    // Sort by when favorited, most recent first
    items.sort((a, b) => {
      const aFav = a.favoritedAt || 0;
      const bFav = b.favoritedAt || 0;
      if (bFav !== aFav) return bFav - aFav;
      return b.lastSavedAt - a.lastSavedAt;
    });
    break;
  case 'frequent':
    items.sort((a, b) => {
      if (b.saveCount !== a.saveCount) return b.saveCount - a.saveCount;
      return b.lastSavedAt - a.lastSavedAt;
    });
    break;
  case 'hidden':
    items.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
    break;
}
```

#### 3.5 Update Exports

Update `src/lib/db/index.ts` if score functions were exported there.

---

### Step 4: Update useItems Hook

**File**: `src/hooks/useItems.ts`

#### 4.1 Update Imports

```typescript
// Before
import { listItemsV2, incrementScore, decrementScore, softDelete, restore } from '@/lib/db/items';

// After
import { listItemsV2, setFavorite, unsetFavorite, softDelete, restore } from '@/lib/db/items';
```

#### 4.2 Update Interface

```typescript
// Before
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

// After
interface UseItemsReturn {
  items: Item[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  favorite: (itemId: string) => Promise<void>;
  unfavorite: (itemId: string) => Promise<void>;
  hide: (itemId: string) => Promise<void>;
  unhide: (itemId: string) => Promise<void>;
}
```

#### 4.3 Replace upvote/downvote with favorite/unfavorite

```typescript
// Remove upvote function, replace with:
const favorite = useCallback(async (itemId: string) => {
  // Optimistic update
  setItems((prev) =>
    prev.map((item) =>
      item.itemId === itemId ? { ...item, favoritedAt: Date.now() } : item
    )
  );

  try {
    await setFavorite(itemId);
  } catch {
    // Revert on error
    setItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, favoritedAt: null } : item
      )
    );
  }
}, []);

// Remove downvote function, replace with:
const unfavorite = useCallback(async (itemId: string) => {
  // Store original value for revert
  const originalFavoritedAt = items.find(i => i.itemId === itemId)?.favoritedAt;

  // Optimistic update
  setItems((prev) =>
    prev.map((item) =>
      item.itemId === itemId ? { ...item, favoritedAt: null } : item
    )
  );

  try {
    await unsetFavorite(itemId);
  } catch {
    // Revert on error
    setItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, favoritedAt: originalFavoritedAt ?? null } : item
      )
    );
  }
}, [items]);
```

#### 4.4 Update Return Statement

```typescript
return {
  items,
  isLoading,
  error,
  hasMore,
  loadMore,
  refresh,
  favorite,     // NEW
  unfavorite,   // NEW
  hide,
  unhide,
};
```

---

### Step 5: Add Votearrow Styles

**File**: `src/styles/globals.css`

Add votearrow CSS:

```css
/* HN-style vote arrow */
.votearrow {
  width: 10px;
  height: 10px;
  border: 0;
  margin: 3px 2px 6px;
  background-color: transparent;
  cursor: pointer;
  padding: 0;
}

.votearrow::before {
  content: '';
  display: block;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 10px solid var(--color-hn-text-secondary);
}

.votearrow:hover::before {
  border-bottom-color: var(--color-hn-text);
}
```

Alternatively, use inline SVG in the component (see Step 6).

---

### Step 6: Update ItemRow Component

**File**: `src/components/ItemRow.tsx`

#### 6.1 Update Imports

```typescript
// Before
import { Globe, ChevronUp, ChevronDown, Trash2, RotateCcw } from 'lucide-react';

// After
import { Globe, Trash2, RotateCcw } from 'lucide-react';
// Remove ChevronUp, ChevronDown
```

#### 6.2 Update Props Interface

```typescript
// Before
interface ItemRowProps {
  item: Item;
  rank: number;
  view: ViewType;
  onUpvote: () => void;
  onDownvote: () => void;
  onHide: () => void;
  onRestore: () => void;
}

// After
interface ItemRowProps {
  item: Item;
  rank: number;
  view: ViewType;
  onFavorite: () => void;
  onUnfavorite: () => void;
  onHide: () => void;
  onRestore: () => void;
}
```

#### 6.3 Update Function Signature

```typescript
export function ItemRow({
  item,
  rank,
  view,
  onFavorite,
  onUnfavorite,
  onHide,
  onRestore,
}: ItemRowProps) {
```

#### 6.4 Create Triangle Component (Inline)

Add this inside ItemRow or as a separate small component:

```tsx
function VoteArrow({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-[10px] h-[10px] p-0 border-0 bg-transparent cursor-pointer"
      title="Add to favorites"
    >
      <svg
        viewBox="0 0 10 10"
        className="w-[10px] h-[10px] text-hn-text-secondary hover:text-hn-text"
      >
        <polygon points="5,0 10,10 0,10" fill="currentColor" />
      </svg>
    </button>
  );
}
```

#### 6.5 Update Vote Button Section

```tsx
// Before
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

// After
{/* Vote arrow - visible only when not favorited, space preserved */}
<div className="w-[14px] shrink-0 flex justify-center pt-1">
  {!item.favoritedAt && !isHiddenView && (
    <VoteArrow onClick={onFavorite} />
  )}
</div>
```

#### 6.6 Update Points Display

```tsx
// Before
<span>{item.score} point{item.score !== 1 ? 's' : ''}</span>

// After
<span>{item.saveCount} point{item.saveCount !== 1 ? 's' : ''}</span>
```

#### 6.7 Remove (Nx) Display

```tsx
// Before
{(view === 'frequent' || item.saveCount > 1) && (
  <span>({item.saveCount}x)</span>
)}

// After
// DELETE THIS ENTIRE BLOCK - saveCount is now shown as points
```

#### 6.8 Add Unfavorite Link

```tsx
// Before (actions section)
{isHiddenView ? (
  <button onClick={onRestore} className="hover:underline flex items-center gap-0.5">
    <RotateCcw size={10} />
    restore
  </button>
) : (
  <button onClick={onHide} className="hover:underline flex items-center gap-0.5">
    <Trash2 size={10} />
    hide
  </button>
)}

// After (actions section)
{isHiddenView ? (
  <button onClick={onRestore} className="hover:underline flex items-center gap-0.5">
    <RotateCcw size={10} />
    restore
  </button>
) : (
  <>
    {item.favoritedAt && (
      <button onClick={onUnfavorite} className="hover:underline">
        unfavorite
      </button>
    )}
    <button onClick={onHide} className="hover:underline flex items-center gap-0.5">
      <Trash2 size={10} />
      hide
    </button>
  </>
)}
```

---

### Step 7: Update ItemList Component

**File**: `src/components/ItemList.tsx`

Update the props passed to ItemRow:

```tsx
// Before
<ItemRow
  key={item.itemId}
  item={item}
  rank={index + 1}
  view={view}
  onUpvote={() => onUpvote(item.itemId)}
  onDownvote={() => onDownvote(item.itemId)}
  onHide={() => onHide(item.itemId)}
  onRestore={() => onRestore(item.itemId)}
/>

// After
<ItemRow
  key={item.itemId}
  item={item}
  rank={index + 1}
  view={view}
  onFavorite={() => onFavorite(item.itemId)}
  onUnfavorite={() => onUnfavorite(item.itemId)}
  onHide={() => onHide(item.itemId)}
  onRestore={() => onRestore(item.itemId)}
/>
```

Also update the ItemList props interface:

```typescript
// Before
interface ItemListProps {
  // ...
  onUpvote: (itemId: string) => void;
  onDownvote: (itemId: string) => void;
  // ...
}

// After
interface ItemListProps {
  // ...
  onFavorite: (itemId: string) => void;
  onUnfavorite: (itemId: string) => void;
  // ...
}
```

---

### Step 8: Update Header Component

**File**: `src/components/Header.tsx`

```typescript
// Before
const NAV_ITEMS: { view: ViewType; label: string }[] = [
  { view: 'new', label: 'new' },
  { view: 'old', label: 'old' },
  { view: 'priority', label: 'priority' },
  { view: 'frequent', label: 'frequent' },
  { view: 'hidden', label: 'hidden' },
];

// After
const NAV_ITEMS: { view: ViewType; label: string }[] = [
  { view: 'new', label: 'new' },
  { view: 'old', label: 'old' },
  { view: 'favorites', label: 'favorites' },
  { view: 'frequent', label: 'frequent' },
  { view: 'hidden', label: 'hidden' },
];
```

---

### Step 9: Update App.tsx

**File**: `src/entrypoints/newtab/App.tsx`

Update the props passed from useItems to ItemList:

```tsx
// Before
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

// ...

<ItemList
  // ...
  onUpvote={upvote}
  onDownvote={downvote}
  // ...
/>

// After
const {
  items,
  isLoading,
  error,
  hasMore,
  loadMore,
  refresh,
  favorite,
  unfavorite,
  hide,
  unhide,
} = useItems(currentView);

// ...

<ItemList
  // ...
  onFavorite={favorite}
  onUnfavorite={unfavorite}
  // ...
/>
```

---

### Step 10: Update Settings Migration

**File**: `src/lib/settings.ts`

If a user had `defaultView: 'priority'`, we need to migrate it:

```typescript
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<Settings> | undefined;
  const settings = { ...DEFAULT_SETTINGS, ...stored };

  // Migrate 'priority' to 'favorites'
  if ((settings.defaultView as string) === 'priority') {
    settings.defaultView = 'favorites';
    // Persist the migration
    await updateSettings({ defaultView: 'favorites' });
  }

  return settings;
}
```

---

### Step 11: Update ViewContext (if needed)

**File**: `src/contexts/ViewContext.tsx`

Check if there's any hardcoded 'priority' references and update to 'favorites'.

---

## Verification Checklist

After implementation, verify:

```bash
pnpm typecheck   # No TypeScript errors
pnpm build       # Build succeeds
pnpm test        # Tests pass (may need updates)
```

### Manual Testing

1. **Fresh install**
   - Points show saveCount
   - Triangle visible, click to favorite
   - Arrow disappears after favoriting
   - "unfavorite" link appears
   - Click unfavorite → arrow reappears

2. **Migration from existing data**
   - Items with score > 0 → favorited
   - Items with score = 0 → not favorited
   - No data loss

3. **Views**
   - "favorites" tab shows favorited items
   - Sorted by favoritedAt desc
   - Other views work correctly

4. **Edge cases**
   - Hidden items don't show vote arrow
   - Favorited items in hidden view
   - Rapid favorite/unfavorite clicks

---

## Files Changed Summary

| File | Lines Changed (est.) |
|------|---------------------|
| `src/types/index.ts` | ~10 |
| `src/lib/db/schema.ts` | ~20 |
| `src/lib/db/items.ts` | ~50 |
| `src/hooks/useItems.ts` | ~40 |
| `src/components/ItemRow.tsx` | ~60 |
| `src/components/ItemList.tsx` | ~15 |
| `src/components/Header.tsx` | ~2 |
| `src/entrypoints/newtab/App.tsx` | ~10 |
| `src/lib/settings.ts` | ~10 |
| `src/styles/globals.css` | ~15 (optional) |

**Total**: ~230 lines changed

---

## Rollback Plan

If issues arise:
1. Database migration is one-way (score → favoritedAt)
2. To rollback, would need v5 migration to restore score field
3. Data preserved: favoritedAt can be converted back to score = 1

---

## Testing Updates

Update or create tests for:
- `src/lib/db/items.test.ts` - Test setFavorite/unsetFavorite
- `src/lib/capture/tabs.test.ts` - Verify no score references

---

## Post-Implementation

After Phase 7:
1. Update README.md if needed
2. Update CLAUDE.md if needed
3. Consider adding to debug/ if issues found during testing

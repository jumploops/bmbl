# Spec: Favorites Redesign

**Date**: 2026-01-04
**Status**: Draft
**Replaces**: Priority/Score system from `spec/init.md`

---

## Overview

This spec redefines how user engagement signals work in bmbl. The current numeric "score" system (upvote/downvote to change points) is replaced with a simpler, more intuitive model:

| Signal | Type | Source | Purpose |
|--------|------|--------|---------|
| **Points** | Automatic | Tab occurrences (`saveCount`) | Relevance based on browsing behavior |
| **Favorite** | Manual | User toggle | Explicit "I want to read this" marker |

---

## Motivation

### Problems with Current Design

1. **Confusing dual metrics**: UI shows both "X points" (score) and "(Nx)" (saveCount) — users don't understand the difference
2. **Unclear semantics**: What does "5 points" mean? It's an arbitrary number the user incremented
3. **Unnecessary complexity**: Upvote/downvote for a personal reading list adds friction without value
4. **Misaligned with behavior**: The real relevance signal is how often you have a tab open, not manual voting

### Benefits of New Design

1. **Points = automatic relevance**: The number reflects real browsing behavior (how many times you've had this open)
2. **Favorite = explicit intent**: A single toggle for "I specifically want to read this"
3. **Simpler UI**: One action (favorite) instead of two (upvote/downvote)
4. **HN-style aesthetics**: Triangle votearrow matches Hacker News visual language

---

## Data Model Changes

### Item Interface

```typescript
// Before
interface Item {
  // ...
  saveCount: number;    // Times captured (automatic)
  score: number;        // User-controlled points (upvote/downvote)
  // ...
}

// After
interface Item {
  // ...
  saveCount: number;      // Times captured (automatic) — displayed as "points"
  favoritedAt: number | null;  // Timestamp when favorited, null if not favorited
  // ...
}
```

### Field Semantics

| Field | Type | Description |
|-------|------|-------------|
| `saveCount` | `number` | Total tab occurrences across all captures. Displayed as "X points" in UI. |
| `favoritedAt` | `number \| null` | Unix timestamp when user favorited. `null` = not favorited. |

**Why `favoritedAt` instead of `favorited: boolean`?**
- Enables "favorites" view to sort by when favorited (most recent first)
- Provides audit trail for future features (e.g., "favorited 3 days ago")
- Follows existing pattern (`deletedAt`, `lastSavedAt`)

---

## UI Changes

### Item Row

#### Before
```
1. ▲  📄 Article Title (example.com)
   ▼     5 points | saved 2h ago | (3x) | hide
```

#### After (not favorited)
```
1. △  📄 Article Title (example.com)
        3 points | saved 2h ago | hide
```

#### After (favorited — arrow hidden, space preserved)
```
1.    📄 Article Title (example.com)
        3 points | saved 2h ago | unfavorite | hide
```

Changes:
- **Remove downvote arrow** (▼)
- **Replace upvote chevron with HN-style triangle** (△)
- **Triangle visible only when NOT favorited** — click to favorite
- **Triangle hidden when favorited** — space preserved for alignment
- **Add "unfavorite" action** in metadata line for favorited items
- **Points now shows `saveCount`** instead of `score`
- **Remove "(Nx)" display** — redundant since points IS the count now

### Vote Arrow Styling (HN-style)

```css
.votearrow {
  width: 10px;
  height: 10px;
  border: 0;
  margin: 3px 2px 6px;
  background: url(triangle.svg);
  background-size: 10px;
  cursor: pointer;
}

.votearrow.favorited {
  /* Filled/highlighted state */
  filter: brightness(0) saturate(100%) /* orange or purple tint */;
}
```

The triangle SVG should match HN's visual style — a simple upward-pointing triangle.

---

## View Changes

### Navigation

```
Before: new | old | priority | frequent | hidden
After:  new | old | favorites | frequent | hidden
```

### View Definitions

| View | Filter | Sort |
|------|--------|------|
| `new` | `deletedAt === null` | `lastSavedAt` desc |
| `old` | `deletedAt === null` | `lastSavedAt` asc |
| `favorites` | `deletedAt === null && favoritedAt !== null` | `favoritedAt` desc |
| `frequent` | `deletedAt === null` | `saveCount` desc, `lastSavedAt` desc |
| `hidden` | `deletedAt !== null` | `deletedAt` desc |

**Key change**: "priority" becomes "favorites" — shows only favorited items, sorted by when they were favorited (most recent first).

---

## Behavior

### Favorite Toggle

| Current State | Action | Result |
|---------------|--------|--------|
| Not favorited (`favoritedAt === null`) | Click triangle | Set `favoritedAt = Date.now()` |
| Favorited (`favoritedAt !== null`) | Click triangle | Set `favoritedAt = null` |

### Visual Feedback (HN-style)

- **Not favorited**: Gray triangle visible, clickable
- **Favorited**: Triangle **hidden** (invisible), but space preserved for alignment
- **Hover** (when visible): Subtle highlight to indicate clickability
- **Click**: Triangle disappears immediately (optimistic UI)

This matches Hacker News behavior where the vote arrow disappears after voting, maintaining layout alignment.

### Unfavoriting

Since the arrow disappears when favorited, unfavoriting happens via:
- **In "favorites" view**: A dedicated "unfavorite" or "remove" action (similar to "restore" in hidden view)
- **Alternative**: Click the invisible space where the arrow was (HN allows this within a time window)

Recommendation: Add an "unfavorite" link in the metadata line, only visible for favorited items (or only in favorites view).

### Points Display

Points always shows `saveCount`:
- `1 point` when `saveCount === 1`
- `N points` when `saveCount > 1`

This is automatic — users cannot manually change it.

---

## Migration

### Database Migration (v4)

```typescript
this.version(4)
  .stores({
    items: 'itemId, &normalizedUrl, lastSavedAt, saveCount, favoritedAt, deletedAt, updatedAt',
    // ... other stores unchanged
  })
  .upgrade(tx => {
    return tx.table('items').toCollection().modify(item => {
      // Convert score > 0 to favorited
      if (item.score && item.score > 0) {
        item.favoritedAt = item.updatedAt || Date.now();
      } else {
        item.favoritedAt = null;
      }
      // Remove score field
      delete item.score;
    });
  });
```

**Migration logic**: Items with `score > 0` become favorited (preserving user intent).

---

## API Changes

### DAL Functions

```typescript
// Remove
export async function incrementScore(itemId: string): Promise<void>;
export async function decrementScore(itemId: string): Promise<void>;
export async function setScore(itemId: string, score: number): Promise<void>;

// Add
export async function toggleFavorite(itemId: string): Promise<boolean>;
// Returns: true if now favorited, false if now unfavorited
```

### Hook Changes

```typescript
// Before (useItems)
upvote: (itemId: string) => Promise<void>;
downvote: (itemId: string) => Promise<void>;

// After (useItems)
favorite: (itemId: string) => Promise<void>;    // Add to favorites
unfavorite: (itemId: string) => Promise<void>;  // Remove from favorites
```

---

## Component Changes

### ItemRow Props

```typescript
// Before
interface ItemRowProps {
  // ...
  onUpvote: () => void;
  onDownvote: () => void;
  // ...
}

// After
interface ItemRowProps {
  // ...
  onFavorite: () => void;    // Click arrow to favorite
  onUnfavorite: () => void;  // Click "unfavorite" link
  // ...
}
```

### ItemRow Implementation

```tsx
// Vote arrow section — visible only when NOT favorited
<div className="w-[10px] shrink-0">
  {!item.favoritedAt && (
    <button
      onClick={onFavorite}
      className="votearrow"
      title="Add to favorites"
    />
  )}
</div>

// Points display (in metadata line)
<span>{item.saveCount} point{item.saveCount !== 1 ? 's' : ''}</span>

// Unfavorite link — visible only when favorited
{item.favoritedAt && (
  <button onClick={onUnfavorite} className="hover:underline">
    unfavorite
  </button>
)}
```

The `<div className="w-[10px]">` wrapper ensures the space is preserved even when the button is hidden, maintaining alignment across all rows.

---

## Assets

### Triangle SVG

Create `public/triangle.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <polygon points="5,0 10,10 0,10" fill="#828282"/>
</svg>
```

Or use inline SVG in the component for easier color control.

---

## Type Changes

### ViewType

```typescript
// Before
export type ViewType = 'new' | 'old' | 'priority' | 'frequent' | 'hidden';

// After
export type ViewType = 'new' | 'old' | 'favorites' | 'frequent' | 'hidden';
```

### Item Interface

```typescript
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
  favoritedAt: number | null;  // NEW: replaces score
  deletedAt: number | null;
  lastOpenedAt: number | null;
  updatedAt: number;
}
```

---

## Settings Changes

### Default View

```typescript
// Before
export interface Settings {
  // ...
  defaultView: ViewType;  // Could be 'priority'
}

// After
// Migration: If defaultView === 'priority', change to 'favorites'
```

---

## Summary of Changes

| Area | Before | After |
|------|--------|-------|
| **Data: score** | `score: number` | Removed |
| **Data: favorite** | N/A | `favoritedAt: number \| null` |
| **UI: points** | Shows `score` | Shows `saveCount` |
| **UI: (Nx)** | Shows `saveCount` | Removed (redundant) |
| **UI: upvote** | ChevronUp, increments score | Triangle, click to favorite (then hidden) |
| **UI: downvote** | ChevronDown, decrements score | Removed |
| **UI: unfavorite** | N/A | Text link in metadata line |
| **View: priority** | `score > 0`, sort by score | Renamed to "favorites" |
| **View: favorites** | N/A | `favoritedAt !== null`, sort by favoritedAt |

---

## Implementation Phases

### Phase 7A: Data Model

1. Update `Item` interface (remove `score`, add `favoritedAt`)
2. Add database migration (v4)
3. Update `ViewType` (`priority` → `favorites`)
4. Add `toggleFavorite` DAL function
5. Remove score-related DAL functions

### Phase 7B: UI Components

1. Create triangle SVG or inline component
2. Update `ItemRow` — remove downvote, change upvote to favorite toggle
3. Update points display to use `saveCount`
4. Remove `(Nx)` display
5. Update `Header` — rename "priority" to "favorites"

### Phase 7C: Hooks & Logic

1. Update `useItems` — remove upvote/downvote, add toggleFavorite
2. Update `listItemsV2` — handle `favorites` view
3. Update settings migration for defaultView

### Phase 7D: Polish

1. Add hover/active states for favorite button
2. Verify optimistic UI works correctly
3. Test migration from existing data

---

## Open Questions

1. **Favorite color**: Orange (HN-style) or purple (bmbl brand)?
   - Recommendation: Purple to match bmbl header

2. **Should favorited items appear differently in other views?**
   - Option A: Show filled triangle in all views
   - Option B: Only show favorite state in favorites view
   - Recommendation: Option A — consistent visual feedback

3. **Undo toast for unfavorite?**
   - Current: No undo for score changes
   - Recommendation: No undo needed — toggle is easy to reverse

---

## Acceptance Criteria

- [ ] Points display shows `saveCount`, not `score`
- [ ] No "(Nx)" display in UI
- [ ] Single triangle votearrow (no downvote)
- [ ] Triangle toggles favorite state on click
- [ ] Filled/colored triangle when favorited
- [ ] "priority" view renamed to "favorites"
- [ ] Favorites view shows only favorited items
- [ ] Favorites sorted by `favoritedAt` desc
- [ ] Existing items with `score > 0` migrated to favorited
- [ ] All tests pass
- [ ] TypeScript compiles without errors

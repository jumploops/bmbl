# Plan: Delete All Data Feature

**Date**: 2026-01-05
**Status**: Implemented

---

## Overview

Add a "Delete All Data" feature to the Settings page Data section that allows users to permanently delete all their bookmarks, captures, and capture events while keeping the database schema intact.

---

## Current Implementation Analysis

### Database Schema (`src/lib/db/schema.ts`)

Three tables need to be cleared:

```typescript
export class BmblDatabase extends Dexie {
  items!: Table<Item, string>;           // Bookmarks
  captures!: Table<Capture, string>;      // Capture history
  captureEvents!: Table<CaptureEvent, [string, string]>; // Capture details
}
```

**Dexie API for clearing tables:**
```typescript
await db.items.clear();      // Removes all records, keeps schema/indexes
await db.captures.clear();
await db.captureEvents.clear();
```

### Existing UI Components

| Component | Location | Notes |
|-----------|----------|-------|
| `Button` | `src/components/ui/Button.tsx` | Has `primary` and `secondary` variants |
| `Toggle` | `src/components/ui/Toggle.tsx` | For boolean settings |
| `Select` | `src/components/ui/Select.tsx` | For dropdown settings |

**No modal component exists.** Will need to create one.

### Existing Color System (`src/styles/globals.css`)

Already has destructive colors defined:

```css
:root {
  --destructive: hsl(0 84% 60%);           /* Light mode: bright red */
  --destructive-foreground: hsl(0 0% 100%);
}

.dark {
  --destructive: hsl(0 72% 51%);           /* Dark mode: slightly darker red */
  --destructive-foreground: hsl(0 0% 100%);
}
```

These map to Tailwind classes via `@theme inline`:
```css
--color-destructive: var(--destructive);
--color-destructive-foreground: var(--destructive-foreground);
```

### Existing Hook Pattern (`src/hooks/useImportExport.ts`)

Good pattern for status management:
- Status enum: `'idle' | 'exporting' | 'validating' | 'importing' | 'success' | 'error'`
- Message state for feedback
- Loading states for buttons

---

## Implementation Plan

### 1. Create ConfirmationModal Component

**File**: `src/components/ui/ConfirmationModal.tsx`

A reusable confirmation modal with:
- Overlay backdrop (semi-transparent)
- Modal dialog with title, message, and action buttons
- Cancel and Confirm buttons
- Confirm button uses destructive styling when `variant="destructive"`
- Keyboard support (Escape to close)
- Focus trap for accessibility

```typescript
interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Design considerations:**
- Use native `<dialog>` element for built-in accessibility
- Or use div with proper ARIA attributes (`role="dialog"`, `aria-modal="true"`)
- Portal to document body to avoid z-index issues
- Animation: fade in/out for smooth UX

### 2. Add Destructive Variant to Button

**File**: `src/components/ui/Button.tsx`

Add a new `destructive` variant:

```typescript
variant === 'destructive' && [
  'bg-destructive text-destructive-foreground',
  'hover:bg-red-700 dark:hover:bg-red-600',
  'disabled:opacity-50 disabled:cursor-not-allowed',
],
```

### 3. Create Database Clear Function

**File**: `src/lib/db/clear.ts` (new file)

```typescript
import { db } from './schema';

export interface ClearResult {
  success: boolean;
  itemsDeleted: number;
  capturesDeleted: number;
  captureEventsDeleted: number;
  error?: string;
}

/**
 * Permanently delete all data from the database.
 * Clears items, captures, and captureEvents tables.
 * Schema and indexes are preserved.
 */
export async function clearAllData(): Promise<ClearResult> {
  try {
    // Get counts before clearing for feedback
    const [itemCount, captureCount, eventCount] = await Promise.all([
      db.items.count(),
      db.captures.count(),
      db.captureEvents.count(),
    ]);

    // Clear all tables in a transaction for atomicity
    await db.transaction('rw', [db.items, db.captures, db.captureEvents], async () => {
      await Promise.all([
        db.items.clear(),
        db.captures.clear(),
        db.captureEvents.clear(),
      ]);
    });

    return {
      success: true,
      itemsDeleted: itemCount,
      capturesDeleted: captureCount,
      captureEventsDeleted: eventCount,
    };
  } catch (error) {
    return {
      success: false,
      itemsDeleted: 0,
      capturesDeleted: 0,
      captureEventsDeleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get counts of all data for confirmation message
 */
export async function getDataCounts(): Promise<{
  items: number;
  captures: number;
  captureEvents: number;
}> {
  const [items, captures, captureEvents] = await Promise.all([
    db.items.count(),
    db.captures.count(),
    db.captureEvents.count(),
  ]);
  return { items, captures, captureEvents };
}
```

### 4. Create useDeleteAllData Hook

**File**: `src/hooks/useDeleteAllData.ts` (new file)

```typescript
import { useState, useCallback } from 'react';
import { clearAllData, getDataCounts, type ClearResult } from '@/lib/db/clear';

interface UseDeleteAllDataReturn {
  // Modal state
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;

  // Data counts (for confirmation message)
  itemCount: number;
  isLoadingCounts: boolean;

  // Delete action
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;

  // Result
  result: ClearResult | null;
  clearResult: () => void;
}
```

**Flow:**
1. User clicks "Delete All Data" button
2. `openModal()` is called, which also fetches current counts
3. Modal shows: "Are you sure? This will delete X bookmarks, Y captures..."
4. User clicks "Delete" → `confirmDelete()` runs
5. On success: close modal, show success message
6. On error: show error in modal or as status message

### 5. Update Options Page

**File**: `src/entrypoints/options/App.tsx`

Add a new "Danger Zone" subsection within the Data section:

```tsx
{/* Delete All Data */}
<div className="py-3 border-t border-red-200 dark:border-red-900 mt-4">
  <h3 className="font-medium mb-2 text-red-600 dark:text-red-400">
    Danger Zone
  </h3>
  <p className="text-sm text-hn-text-secondary mb-3">
    Permanently delete all your bookmarks and capture history.
    This action cannot be undone.
  </p>
  <Button
    variant="destructive"
    size="sm"
    onClick={openDeleteModal}
    disabled={isDeleting}
  >
    {isDeleting ? 'Deleting...' : 'Delete All Data'}
  </Button>
</div>

{/* Confirmation Modal */}
<ConfirmationModal
  isOpen={isDeleteModalOpen}
  title="Delete All Data"
  message={
    <>
      <p>Are you sure you want to delete all your data?</p>
      <p className="mt-2 text-sm text-hn-text-secondary">
        This will permanently delete:
      </p>
      <ul className="mt-1 text-sm list-disc list-inside">
        <li>{itemCount} bookmarks</li>
        <li>{captureCount} capture records</li>
      </ul>
      <p className="mt-3 text-sm text-hn-text-secondary">
        Tip: You can export your bookmarks first using the Export option above.
      </p>
      <p className="mt-2 font-medium text-red-600 dark:text-red-400">
        This action cannot be undone.
      </p>
    </>
  }
  confirmLabel="Delete Everything"
  cancelLabel="Cancel"
  variant="destructive"
  isLoading={isDeleting}
  onConfirm={confirmDelete}
  onCancel={closeDeleteModal}
/>
```

---

## UI Design Details

### Delete All Data Button

- **Color**: Red background (`bg-destructive`)
- **Text**: White (`text-destructive-foreground`)
- **Hover**: Darker red
- **Position**: At bottom of Data section, separated by "Danger Zone" heading

### Confirmation Modal

```
┌─────────────────────────────────────────────┐
│  Delete All Data                        [×] │
├─────────────────────────────────────────────┤
│                                             │
│  Are you sure you want to delete all        │
│  your data?                                 │
│                                             │
│  This will permanently delete:              │
│  • 142 bookmarks                            │
│  • 23 capture records                       │
│                                             │
│  Tip: You can export your bookmarks first   │
│  using the Export option above.             │
│                                             │
│  ⚠️ This action cannot be undone.           │
│                                             │
├─────────────────────────────────────────────┤
│              [Cancel]  [Delete Everything]  │
└─────────────────────────────────────────────┘
```

**Modal styling:**
- Max width: 400px
- Background: white (light) / gray-800 (dark)
- Border: gray-200 (light) / gray-700 (dark)
- Shadow: lg
- Rounded corners
- Centered on screen
- Backdrop: black with 50% opacity

**Button styling in modal:**
- Cancel: Secondary variant (gray)
- Delete: Destructive variant (red)

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/ui/ConfirmationModal.tsx` | Create | Reusable confirmation modal |
| `src/components/ui/Button.tsx` | Modify | Add `destructive` variant |
| `src/lib/db/clear.ts` | Create | Database clear functions |
| `src/hooks/useDeleteAllData.ts` | Create | Hook for delete flow |
| `src/entrypoints/options/App.tsx` | Modify | Add Danger Zone section |

---

## Error Handling

1. **Transaction failure**: Show error message, don't close modal
2. **Network issues**: N/A (local database)
3. **Concurrent operations**: Dexie handles this via transactions

---

## Accessibility Considerations

1. **Focus management**: Focus moves to modal when opened, returns to trigger when closed
2. **Keyboard navigation**:
   - `Escape` closes modal
   - `Tab` cycles through modal buttons
   - `Enter` on focused button triggers action
3. **Screen readers**:
   - Modal has `role="dialog"` and `aria-modal="true"`
   - `aria-labelledby` points to title
   - `aria-describedby` points to description
4. **Color contrast**: Red text meets WCAG AA contrast requirements

---

## Testing Plan

### Manual Testing

1. **Happy path**:
   - Add some bookmarks via capture
   - Go to Settings → Data
   - Click "Delete All Data"
   - Verify modal shows correct counts
   - Click "Delete Everything"
   - Verify success message
   - Verify new tab page shows empty state

2. **Cancel flow**:
   - Click "Delete All Data"
   - Click "Cancel"
   - Verify modal closes, data intact

3. **Escape key**:
   - Open modal
   - Press Escape
   - Verify modal closes, data intact

4. **Already empty**:
   - Delete all data
   - Try to delete again
   - Verify modal shows "0 bookmarks, 0 captures"
   - Verify delete still works (no-op)

5. **Dark mode**:
   - Verify red colors are appropriate in dark mode
   - Verify modal backdrop is visible

### Edge Cases

1. **Very large dataset**: Should still work (Dexie clear is efficient)
2. **Concurrent tab open**: Other tabs should reflect empty state after refresh

---

## Security Considerations

1. **No confirmation bypass**: Always require modal confirmation
2. **No accidental trigger**: Button is clearly labeled and separated
3. **Visual warning**: Red color and "Danger Zone" heading
4. **Explicit action text**: "Delete Everything" not just "OK" or "Confirm"

---

## Future Enhancements (Out of Scope)

1. **Selective delete**: Delete by date range or view
2. **Undo with time limit**: Keep deleted data for 30 seconds
3. **Require typing confirmation**: Type "DELETE" to confirm (overkill for this use case)

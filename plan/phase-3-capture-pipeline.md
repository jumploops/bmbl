# Phase 3: Capture Pipeline

**Goal**: Implement the complete tab capture functionality in the service worker, including tab querying, URL filtering, upsert logic, auto-close behavior, icon state management, and message passing.

**Dependencies**: Phase 1 (Project Setup), Phase 2 (Data Layer)

**Estimated scope**: Medium

---

## Overview

This phase implements:
- Service worker with capture logic
- Tab and window querying
- Tab group metadata collection
- Atomic capture transaction
- Auto-close behavior (respecting pinned tabs)
- Icon state changes (default → loading → success)
- Message passing between new tab page and service worker
- Settings initialization on install

---

## Implementation Steps

### 1. Capture Types

Add to **src/types/index.ts**:
```ts
// ============================================
// Message Types
// ============================================

export type MessageType =
  | 'CAPTURE_ALL_TABS'
  | 'CAPTURE_RESULT'
  | 'GET_LAST_CAPTURE';

export interface CaptureMessage {
  type: 'CAPTURE_ALL_TABS';
}

export interface CaptureResultMessage {
  type: 'CAPTURE_RESULT';
  result: CaptureResult;
}

export interface GetLastCaptureMessage {
  type: 'GET_LAST_CAPTURE';
}

export type Message = CaptureMessage | GetLastCaptureMessage;

export type MessageResponse = CaptureResult | Capture | null;
```

### 2. Icon Assets

Create icon variants in `public/icon/`:
- `default-16.png`, `default-32.png`, `default-48.png`, `default-128.png` - Normal state
- `loading-16.png`, `loading-32.png`, `loading-48.png`, `loading-128.png` - Capture in progress
- `success-16.png`, `success-32.png`, `success-48.png`, `success-128.png` - Capture complete

**Icon design suggestions:**
- Default: Purple bookmark/stack icon
- Loading: Same icon with subtle indicator (different shade or dots)
- Success: Same icon with checkmark overlay

### 3. Icon Management

**src/lib/capture/icons.ts**
```ts
type IconState = 'default' | 'loading' | 'success';

const ICON_PATHS: Record<IconState, Record<number, string>> = {
  default: {
    16: 'icon/default-16.png',
    32: 'icon/default-32.png',
    48: 'icon/default-48.png',
    128: 'icon/default-128.png',
  },
  loading: {
    16: 'icon/loading-16.png',
    32: 'icon/loading-32.png',
    48: 'icon/loading-48.png',
    128: 'icon/loading-128.png',
  },
  success: {
    16: 'icon/success-16.png',
    32: 'icon/success-32.png',
    48: 'icon/success-48.png',
    128: 'icon/success-128.png',
  },
};

let successTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Set the extension icon state
 */
export async function setIconState(state: IconState): Promise<void> {
  // Clear any pending success timeout
  if (successTimeout) {
    clearTimeout(successTimeout);
    successTimeout = null;
  }

  await chrome.action.setIcon({
    path: ICON_PATHS[state],
  });

  // If success, revert to default after 5 seconds
  if (state === 'success') {
    successTimeout = setTimeout(() => {
      chrome.action.setIcon({ path: ICON_PATHS.default });
      successTimeout = null;
    }, 5000);
  }
}

/**
 * Set icon to default state
 */
export async function resetIcon(): Promise<void> {
  await setIconState('default');
}
```

### 4. Tab Query Utilities

**src/lib/capture/tabs.ts**
```ts
import type { TabInfo, TabGroupInfo } from '@/types';
import { isCapturableUrl } from '@/lib/utils/url';

/**
 * Query all tabs across all windows
 */
export async function queryAllTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({});
}

/**
 * Query all tab groups
 */
export async function queryAllTabGroups(): Promise<chrome.tabGroups.TabGroup[]> {
  try {
    return await chrome.tabGroups.query({});
  } catch {
    // tabGroups API might not be available in all contexts
    return [];
  }
}

/**
 * Build a map of groupId -> group info
 */
export function buildGroupMap(groups: chrome.tabGroups.TabGroup[]): Map<number, TabGroupInfo> {
  const map = new Map<number, TabGroupInfo>();
  for (const group of groups) {
    map.set(group.id, {
      groupId: group.id,
      title: group.title || null,
      color: group.color || null,
    });
  }
  return map;
}

/**
 * Filter and transform Chrome tabs to our TabInfo format
 * Returns both capturable tabs and skipped count
 */
export function filterAndTransformTabs(
  tabs: chrome.tabs.Tab[],
  groupMap: Map<number, TabGroupInfo>
): { capturableTabs: TabInfo[]; skippedCount: number } {
  const capturableTabs: TabInfo[] = [];
  let skippedCount = 0;

  for (const tab of tabs) {
    // Skip tabs without URLs
    if (!tab.url || !tab.id) {
      skippedCount++;
      continue;
    }

    // Check if URL is capturable
    if (!isCapturableUrl(tab.url)) {
      skippedCount++;
      continue;
    }

    const groupInfo = tab.groupId !== -1 ? groupMap.get(tab.groupId) : undefined;

    capturableTabs.push({
      tabId: tab.id,
      windowId: tab.windowId,
      url: tab.url,
      title: tab.title || '',
      favIconUrl: tab.favIconUrl || null,
      pinned: tab.pinned || false,
      groupId: tab.groupId,
    });
  }

  return { capturableTabs, skippedCount };
}

/**
 * Close tabs by ID, excluding pinned tabs
 */
export async function closeTabsExcludingPinned(tabs: TabInfo[]): Promise<void> {
  const tabsToClose = tabs
    .filter(tab => !tab.pinned)
    .map(tab => tab.tabId);

  if (tabsToClose.length > 0) {
    await chrome.tabs.remove(tabsToClose);
  }
}
```

### 5. Capture Logic

**src/lib/capture/capture.ts**
```ts
import { db } from '@/lib/db/schema';
import { upsertItem } from '@/lib/db/items';
import { createCapture, insertCaptureEvent } from '@/lib/db/captures';
import { getSettings } from '@/lib/settings';
import { setIconState } from './icons';
import { queryAllTabs, queryAllTabGroups, buildGroupMap, filterAndTransformTabs, closeTabsExcludingPinned } from './tabs';
import type { CaptureResult, CaptureEvent, TabInfo, TabGroupInfo } from '@/types';
import { generateId } from '@/lib/utils/uuid';

// Track if capture is in progress to prevent concurrent captures
let captureInProgress = false;

/**
 * Check if a capture is currently in progress
 */
export function isCaptureInProgress(): boolean {
  return captureInProgress;
}

/**
 * Perform a full capture of all open tabs
 */
export async function captureAllTabs(): Promise<CaptureResult> {
  if (captureInProgress) {
    throw new Error('Capture already in progress');
  }

  captureInProgress = true;

  try {
    // Set loading icon
    await setIconState('loading');

    // Get settings
    const settings = await getSettings();

    // Query all tabs and groups
    const [allTabs, allGroups] = await Promise.all([
      queryAllTabs(),
      queryAllTabGroups(),
    ]);

    const groupMap = buildGroupMap(allGroups);
    const { capturableTabs, skippedCount } = filterAndTransformTabs(allTabs, groupMap);

    // Prepare capture stats
    let tabCountUpdatedExisting = 0;
    let tabCountInsertedNew = 0;
    let tabCountAlreadyDeleted = 0;

    // Generate capture ID upfront
    const captureId = generateId();
    const capturedAt = Date.now();

    // Use a Dexie transaction for atomicity
    await db.transaction('rw', [db.items, db.captures, db.captureEvents], async () => {
      // Process each tab
      for (const tab of capturableTabs) {
        const { item, isNew, wasDeleted } = await upsertItem(
          tab.url,
          tab.title,
          tab.favIconUrl
        );

        if (isNew) {
          tabCountInsertedNew++;
        } else if (wasDeleted) {
          tabCountAlreadyDeleted++;
        } else {
          tabCountUpdatedExisting++;
        }

        // Get group info
        const groupInfo = tab.groupId !== -1 ? groupMap.get(tab.groupId) : undefined;

        // Create capture event
        const event: CaptureEvent = {
          captureId,
          itemId: item.itemId,
          capturedAt,
          windowId: tab.windowId,
          tabId: tab.tabId,
          pinned: tab.pinned,
          groupId: groupInfo?.groupId ?? null,
          groupTitle: groupInfo?.title ?? null,
          groupColor: groupInfo?.color ?? null,
        };

        await insertCaptureEvent(event);
      }

      // Create capture record
      await createCapture({
        tabCountCaptured: capturableTabs.length,
        tabCountSkippedInternal: skippedCount,
        tabCountUpdatedExisting,
        tabCountInsertedNew,
        tabCountAlreadyDeleted,
        autoCloseEnabled: settings.autoCloseAfterSave,
      });
    });

    // Auto-close tabs if enabled
    if (settings.autoCloseAfterSave) {
      await closeTabsExcludingPinned(capturableTabs);
    }

    // Set success icon
    await setIconState('success');

    return {
      captureId,
      tabCountCaptured: capturableTabs.length,
      tabCountSkippedInternal: skippedCount,
      tabCountUpdatedExisting,
      tabCountInsertedNew,
      tabCountAlreadyDeleted,
    };
  } finally {
    captureInProgress = false;
  }
}
```

### 6. Service Worker

**src/entrypoints/background.ts**
```ts
import { captureAllTabs, isCaptureInProgress } from '@/lib/capture/capture';
import { resetIcon } from '@/lib/capture/icons';
import { initializeSettings } from '@/lib/settings';
import { getLastCapture } from '@/lib/db/captures';
import type { Message, CaptureResult, Capture } from '@/types';

export default defineBackground(() => {
  console.log('bmbl background script loaded');

  // Initialize settings on install
  chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension installed/updated:', details.reason);
    await initializeSettings();
    await resetIcon();
  });

  // Handle toolbar icon click
  chrome.action.onClicked.addListener(async () => {
    console.log('Toolbar icon clicked');

    if (isCaptureInProgress()) {
      console.log('Capture already in progress, ignoring click');
      return;
    }

    try {
      const result = await captureAllTabs();
      console.log('Capture complete:', result);
    } catch (error) {
      console.error('Capture failed:', error);
      await resetIcon();
    }
  });

  // Handle messages from new tab page
  chrome.runtime.onMessage.addListener(
    (message: Message, sender, sendResponse): boolean => {
      console.log('Received message:', message);

      if (message.type === 'CAPTURE_ALL_TABS') {
        if (isCaptureInProgress()) {
          sendResponse({ error: 'Capture already in progress' });
          return false;
        }

        // Async handler
        captureAllTabs()
          .then((result) => {
            sendResponse(result);
          })
          .catch((error) => {
            console.error('Capture failed:', error);
            sendResponse({ error: error.message });
          });

        // Return true to indicate async response
        return true;
      }

      if (message.type === 'GET_LAST_CAPTURE') {
        getLastCapture()
          .then((capture) => {
            sendResponse(capture || null);
          })
          .catch((error) => {
            console.error('Failed to get last capture:', error);
            sendResponse(null);
          });

        return true;
      }

      return false;
    }
  );
});
```

### 7. Capture Hook (for UI)

**src/hooks/useCapture.ts**
```ts
import { useState, useCallback } from 'react';
import type { CaptureResult } from '@/types';

interface UseCaptureReturn {
  capture: () => Promise<CaptureResult | null>;
  isCapturing: boolean;
  lastResult: CaptureResult | null;
  error: string | null;
}

export function useCapture(): UseCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastResult, setLastResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async (): Promise<CaptureResult | null> => {
    if (isCapturing) return null;

    setIsCapturing(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_ALL_TABS' });

      if (response?.error) {
        setError(response.error);
        return null;
      }

      setLastResult(response as CaptureResult);
      return response as CaptureResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Capture failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  return { capture, isCapturing, lastResult, error };
}
```

### 8. Last Capture Hook

**src/hooks/useLastCapture.ts**
```ts
import { useState, useEffect } from 'react';
import type { Capture } from '@/types';

export function useLastCapture(): Capture | null {
  const [lastCapture, setLastCapture] = useState<Capture | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_LAST_CAPTURE' })
      .then((capture) => {
        setLastCapture(capture || null);
      })
      .catch((error) => {
        console.error('Failed to get last capture:', error);
      });
  }, []);

  return lastCapture;
}
```

### 9. Capture Index

**src/lib/capture/index.ts**
```ts
export { captureAllTabs, isCaptureInProgress } from './capture';
export { setIconState, resetIcon } from './icons';
export { queryAllTabs, queryAllTabGroups, filterAndTransformTabs, closeTabsExcludingPinned } from './tabs';
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/capture/icons.ts` | Icon state management |
| `src/lib/capture/tabs.ts` | Tab query utilities |
| `src/lib/capture/capture.ts` | Main capture logic |
| `src/lib/capture/index.ts` | Capture exports |
| `src/entrypoints/background.ts` | Service worker (update) |
| `src/hooks/useCapture.ts` | React hook for capture |
| `src/hooks/useLastCapture.ts` | React hook for last capture |
| `public/icon/default-*.png` | Default icon variants |
| `public/icon/loading-*.png` | Loading icon variants |
| `public/icon/success-*.png` | Success icon variants |

---

## Acceptance Criteria

- [ ] Clicking toolbar icon captures all open tabs
- [ ] Internal URLs (chrome://, file://, etc.) are skipped
- [ ] New items are created with correct data
- [ ] Existing items are updated (saveCount increments)
- [ ] Deleted items remain deleted (not resurrected)
- [ ] Tab group metadata is captured
- [ ] Capture is atomic (all or nothing)
- [ ] Icon changes: default → loading → success → default (5s)
- [ ] Rapid clicks are ignored while capture in progress
- [ ] Auto-close works when enabled (pinned tabs preserved)
- [ ] New tab page can trigger capture via message
- [ ] Settings are initialized on extension install

---

## Testing

### Manual Testing Checklist

1. **Basic Capture**
   - Open several tabs (mix of http, https, chrome://, file://)
   - Click extension icon
   - Verify icon changes: default → loading → success
   - Open new tab → see captured items in list

2. **Dedupe**
   - Open the same URL in multiple tabs
   - Capture
   - Verify only one item in list (with saveCount reflecting captures)

3. **Soft Delete Behavior**
   - Hide an item
   - Open that URL in a new tab
   - Capture
   - Verify item is NOT restored (still hidden)
   - Verify saveCount still incremented

4. **Tab Groups**
   - Create a tab group with a name and color
   - Capture
   - Check IndexedDB → captureEvents should have group metadata

5. **Auto-Close**
   - Enable auto-close in settings
   - Pin a tab
   - Capture
   - Verify: non-pinned tabs closed, pinned tab remains

6. **Rapid Clicks**
   - Click icon rapidly multiple times
   - Verify only one capture happens

7. **Message Passing**
   - Add a button in new tab page that calls `useCapture().capture()`
   - Click it
   - Verify capture works and icon changes

### Console Commands
```js
// Check captures
const captures = await chrome.storage.local.get('captures');
console.log(captures);

// View IndexedDB
const db = await indexedDB.open('bmbl');
// Use DevTools IndexedDB viewer
```

---

## Notes

- The service worker may terminate when idle; Dexie handles this gracefully
- Icon assets should be simple and clear at small sizes (16x16)
- The 5-second success timeout is cleared if another capture starts
- Transaction ensures partial captures don't corrupt data

---

## Next Phase

Once this phase is complete, proceed to **Phase 4: New Tab UI** to build the item list interface.

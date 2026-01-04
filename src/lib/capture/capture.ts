import { db } from '@/lib/db/schema';
import { upsertItem } from '@/lib/db/items';
import { createCapture, insertCaptureEvent } from '@/lib/db/captures';
import { getSettings } from '@/lib/settings';
import { setIconState } from './icons';
import {
  queryAllTabs,
  queryAllTabGroups,
  buildGroupMap,
  filterAndTransformTabs,
  closeTabsExcludingPinned,
  aggregateTabsByUrl,
} from './tabs';
import type { CaptureResult, CaptureEvent } from '@/types';
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

    // Aggregate tabs by URL to handle duplicates
    const aggregatedTabs = aggregateTabsByUrl(capturableTabs, groupMap);

    // Prepare capture stats
    let tabCountUpdatedExisting = 0;
    let tabCountInsertedNew = 0;
    let tabCountAlreadyDeleted = 0;

    // Generate capture ID upfront
    const captureId = generateId();
    const capturedAt = Date.now();

    // Use a Dexie transaction for atomicity
    await db.transaction('rw', [db.items, db.captures, db.captureEvents], async () => {
      // Process each UNIQUE URL (not each tab)
      for (const aggregated of aggregatedTabs) {
        const tabCount = aggregated.tabs.length;

        const { item, isNew, wasDeleted } = await upsertItem(
          aggregated.url,
          aggregated.title || null,
          aggregated.favIconUrl,
          tabCount
        );

        // Track stats based on tabs, not unique URLs
        if (isNew) {
          tabCountInsertedNew += tabCount;
        } else if (wasDeleted) {
          tabCountAlreadyDeleted += tabCount;
        } else {
          tabCountUpdatedExisting += tabCount;
        }

        // Create ONE capture event per unique URL
        const event: CaptureEvent = {
          captureId,
          itemId: item.itemId,
          capturedAt,
          tabCount,
          windowIds: aggregated.windowIds,
          tabIds: aggregated.tabIds,
          pinnedAny: aggregated.pinnedAny,
          groupId: aggregated.groupId,
          groupTitle: aggregated.groupTitle,
          groupColor: aggregated.groupColor,
        };

        await insertCaptureEvent(event);
      }

      // Create capture record
      await createCapture({
        tabCountCaptured: capturableTabs.length, // Total tabs
        tabCountSkippedInternal: skippedCount,
        tabCountUpdatedExisting,
        tabCountInsertedNew,
        tabCountAlreadyDeleted,
        autoCloseEnabled: settings.autoCloseAfterSave,
        uniqueUrlCount: aggregatedTabs.length, // Unique URLs
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

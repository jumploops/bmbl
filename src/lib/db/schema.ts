import Dexie, { type Table } from 'dexie';
import type { Item, Capture, CaptureEvent } from '@/types';

export class BmblDatabase extends Dexie {
  items!: Table<Item, string>;
  captures!: Table<Capture, string>;
  captureEvents!: Table<CaptureEvent, [string, string]>;

  constructor() {
    super('bmbl');

    // Version 1: Original schema
    this.version(1).stores({
      items: 'itemId, &normalizedUrl, lastSavedAt, saveCount, score, deletedAt, updatedAt',
      captures: 'captureId, createdAt',
      captureEvents: '[captureId+itemId], captureId, itemId, capturedAt, groupTitle',
    });

    // Version 2: Add tabCount to CaptureEvent, convert single values to arrays
    this.version(2)
      .stores({
        // Schema strings unchanged - Dexie only tracks indexes
        items: 'itemId, &normalizedUrl, lastSavedAt, saveCount, score, deletedAt, updatedAt',
        captures: 'captureId, createdAt',
        captureEvents: '[captureId+itemId], captureId, itemId, capturedAt, groupTitle',
      })
      .upgrade((tx) => {
        // Migrate CaptureEvents to new format
        return tx
          .table('captureEvents')
          .toCollection()
          .modify((event: Record<string, unknown>) => {
            // Add tabCount if missing
            if (event.tabCount === undefined) {
              event.tabCount = 1;
            }

            // Convert windowId to windowIds array
            if (!Array.isArray(event.windowIds)) {
              event.windowIds =
                event.windowId !== undefined ? [event.windowId] : [];
              delete event.windowId;
            }

            // Convert tabId to tabIds array
            if (!Array.isArray(event.tabIds)) {
              event.tabIds = event.tabId !== undefined ? [event.tabId] : [];
              delete event.tabId;
            }

            // Rename pinned to pinnedAny
            if (event.pinnedAny === undefined) {
              event.pinnedAny = event.pinned ?? false;
              delete event.pinned;
            }
          });
      });

    // Version 3: Add uniqueUrlCount to Capture
    this.version(3)
      .stores({
        items: 'itemId, &normalizedUrl, lastSavedAt, saveCount, score, deletedAt, updatedAt',
        captures: 'captureId, createdAt',
        captureEvents: '[captureId+itemId], captureId, itemId, capturedAt, groupTitle',
      })
      .upgrade((tx) => {
        // Add uniqueUrlCount to existing captures (default to tabCountCaptured)
        return tx
          .table('captures')
          .toCollection()
          .modify((capture: Record<string, unknown>) => {
            if (capture.uniqueUrlCount === undefined) {
              // Best guess: assume each tab was a unique URL in old captures
              capture.uniqueUrlCount = capture.tabCountCaptured ?? 0;
            }
          });
      });

    // Version 4: Replace score with favoritedAt (favorites redesign)
    this.version(4)
      .stores({
        // Replace score index with favoritedAt
        items: 'itemId, &normalizedUrl, lastSavedAt, saveCount, favoritedAt, deletedAt, updatedAt',
        captures: 'captureId, createdAt',
        captureEvents: '[captureId+itemId], captureId, itemId, capturedAt, groupTitle',
      })
      .upgrade((tx) => {
        // Convert score to favoritedAt
        return tx
          .table('items')
          .toCollection()
          .modify((item: Record<string, unknown>) => {
            // Items with score > 0 become favorited
            if (item.score && (item.score as number) > 0) {
              item.favoritedAt = (item.updatedAt as number) || Date.now();
            } else {
              item.favoritedAt = null;
            }
            // Remove score field
            delete item.score;
          });
      });

    // Version 5: Add compound indexes for efficient queries, convert nulls to sentinel values
    // This fixes the performance issue where listItems loaded all items into memory.
    // Dexie cannot efficiently query "WHERE field = null" since nulls are excluded from indexes.
    // Using 0 as a sentinel value allows indexed queries like "WHERE deletedAt = 0".
    this.version(5)
      .stores({
        // Compound indexes: [deletedAt+X] enables "WHERE deletedAt=0 ORDER BY X"
        // - [deletedAt+lastSavedAt]: for 'new' and 'old' views
        // - [deletedAt+favoritedAt]: for 'favorites' view
        // - [deletedAt+saveCount]: for 'frequent' view
        // - deletedAt alone: for 'hidden' view (WHERE deletedAt > 0)
        items: 'itemId, &normalizedUrl, [deletedAt+lastSavedAt], [deletedAt+favoritedAt], [deletedAt+saveCount], deletedAt, updatedAt',
        captures: 'captureId, createdAt',
        captureEvents: '[captureId+itemId], captureId, itemId, capturedAt, groupTitle',
      })
      .upgrade((tx) => {
        return tx
          .table('items')
          .toCollection()
          .modify((item: Record<string, unknown>) => {
            // Convert null to 0 for deletedAt (0 = not deleted)
            if (item.deletedAt === null || item.deletedAt === undefined) {
              item.deletedAt = 0;
            }
            // Convert null to 0 for favoritedAt (0 = not favorited)
            if (item.favoritedAt === null || item.favoritedAt === undefined) {
              item.favoritedAt = 0;
            }
            // Also convert lastOpenedAt for consistency
            if (item.lastOpenedAt === null || item.lastOpenedAt === undefined) {
              item.lastOpenedAt = 0;
            }
          });
      });
  }
}

// Singleton database instance
export const db = new BmblDatabase();

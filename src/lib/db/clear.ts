import { db } from './schema';

export interface ClearResult {
  success: boolean;
  itemsDeleted: number;
  capturesDeleted: number;
  captureEventsDeleted: number;
  error?: string;
}

export interface DataCounts {
  items: number;
  captures: number;
  captureEvents: number;
}

/**
 * Get counts of all data for confirmation message
 */
export async function getDataCounts(): Promise<DataCounts> {
  const [items, captures, captureEvents] = await Promise.all([
    db.items.count(),
    db.captures.count(),
    db.captureEvents.count(),
  ]);
  return { items, captures, captureEvents };
}

/**
 * Permanently delete all data from the database.
 * Clears items, captures, and captureEvents tables.
 * Schema and indexes are preserved.
 */
export async function clearAllData(): Promise<ClearResult> {
  try {
    // Get counts before clearing for feedback
    const counts = await getDataCounts();

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
      itemsDeleted: counts.items,
      capturesDeleted: counts.captures,
      captureEventsDeleted: counts.captureEvents,
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

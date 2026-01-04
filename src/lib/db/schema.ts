import Dexie, { type Table } from 'dexie';
import type { Item, Capture, CaptureEvent } from '@/types';

export class BmblDatabase extends Dexie {
  items!: Table<Item, string>;
  captures!: Table<Capture, string>;
  captureEvents!: Table<CaptureEvent, [string, string]>;

  constructor() {
    super('bmbl');

    this.version(1).stores({
      // Primary key is itemId, indexes on other fields
      items: 'itemId, &normalizedUrl, lastSavedAt, saveCount, score, deletedAt, updatedAt',

      // Primary key is captureId
      captures: 'captureId, createdAt',

      // Compound primary key [captureId, itemId]
      captureEvents: '[captureId+itemId], captureId, itemId, capturedAt, groupTitle',
    });
  }
}

// Singleton database instance
export const db = new BmblDatabase();

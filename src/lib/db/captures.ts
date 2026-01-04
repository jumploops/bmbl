import { db } from './schema';
import type { Capture, CaptureEvent } from '@/types';
import { generateId } from '@/lib/utils/uuid';

/**
 * Create a new capture record
 */
export async function createCapture(
  stats: Omit<Capture, 'captureId' | 'createdAt'>
): Promise<string> {
  const captureId = generateId();
  const capture: Capture = {
    captureId,
    createdAt: Date.now(),
    ...stats,
  };
  await db.captures.add(capture);
  return captureId;
}

/**
 * Insert a capture event
 */
export async function insertCaptureEvent(event: CaptureEvent): Promise<void> {
  await db.captureEvents.add(event);
}

/**
 * Get the most recent capture
 */
export async function getLastCapture(): Promise<Capture | undefined> {
  return db.captures
    .orderBy('createdAt')
    .reverse()
    .first();
}

/**
 * Get all captures (for history view, future feature)
 */
export async function listCaptures(limit = 50, offset = 0): Promise<Capture[]> {
  return db.captures
    .orderBy('createdAt')
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray();
}

/**
 * Get capture events for a specific capture
 */
export async function getCaptureEvents(captureId: string): Promise<CaptureEvent[]> {
  return db.captureEvents
    .where('captureId')
    .equals(captureId)
    .toArray();
}

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

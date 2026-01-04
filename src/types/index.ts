// ============================================
// Database Entities
// ============================================

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
  favoritedAt: number | null; // Timestamp when favorited, null if not
  deletedAt: number | null;
  lastOpenedAt: number | null;
  updatedAt: number;
}

export interface Capture {
  captureId: string;
  createdAt: number;
  tabCountCaptured: number;
  tabCountSkippedInternal: number;
  tabCountUpdatedExisting: number;
  tabCountInsertedNew: number;
  tabCountAlreadyDeleted: number;
  autoCloseEnabled: boolean;
  uniqueUrlCount: number; // Count of unique URLs after deduplication
}

export interface CaptureEvent {
  captureId: string;
  itemId: string;
  capturedAt: number;
  tabCount: number; // Number of tabs with this URL in this capture
  windowIds: number[]; // All window IDs where URL appeared
  tabIds: (number | null)[]; // All tab IDs (for debugging/analytics)
  pinnedAny: boolean; // True if ANY tab with this URL was pinned
  groupId: number | null;
  groupTitle: string | null;
  groupColor: string | null;
}

// ============================================
// Views and Sorting
// ============================================

export type ViewType = 'new' | 'old' | 'favorites' | 'frequent' | 'hidden';

export interface ListOptions {
  view: ViewType;
  limit: number;
  offset: number;
}

// ============================================
// Settings
// ============================================

export interface Settings {
  autoCloseAfterSave: boolean;
  resurfaceHiddenOnRecapture: boolean;
  defaultView: ViewType;
}

export const DEFAULT_SETTINGS: Settings = {
  autoCloseAfterSave: false,
  resurfaceHiddenOnRecapture: false,
  defaultView: 'new',
};

// ============================================
// Tab Info (from Chrome API)
// ============================================

export interface TabInfo {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  favIconUrl: string | null;
  pinned: boolean;
  groupId: number;
}

export interface TabGroupInfo {
  groupId: number;
  title: string | null;
  color: string | null;
}

/**
 * Tabs aggregated by normalized URL for a single capture
 */
export interface AggregatedTab {
  normalizedUrl: string;
  url: string; // Representative URL (first tab)
  title: string; // Best available title
  favIconUrl: string | null; // Best available favicon
  tabs: TabInfo[]; // All tabs with this URL
  windowIds: number[];
  tabIds: (number | null)[];
  pinnedAny: boolean;
  groupId: number | null;
  groupTitle: string | null;
  groupColor: string | null;
}

// ============================================
// Capture Results
// ============================================

export interface CaptureResult {
  captureId: string;
  tabCountCaptured: number;
  tabCountSkippedInternal: number;
  tabCountUpdatedExisting: number;
  tabCountInsertedNew: number;
  tabCountAlreadyDeleted: number;
}

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

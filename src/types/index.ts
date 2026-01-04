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
  score: number;
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
}

export interface CaptureEvent {
  captureId: string;
  itemId: string;
  capturedAt: number;
  windowId: number;
  tabId: number | null;
  pinned: boolean;
  groupId: number | null;
  groupTitle: string | null;
  groupColor: string | null;
}

// ============================================
// Views and Sorting
// ============================================

export type ViewType = 'new' | 'old' | 'priority' | 'frequent' | 'hidden';

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

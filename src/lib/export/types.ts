/**
 * Export format types for bmbl bookmarks
 */

export interface ExportOptions {
  includeHidden: boolean;
}

export interface ExportedItem {
  url: string;
  title: string;
  domain?: string;
  favIconUrl?: string | null;
  createdAt?: number;
  lastSavedAt?: number;
  saveCount?: number;
  favoritedAt?: number;
  deletedAt?: number;
}

export interface BmblExport {
  version: 1;
  exportedAt: string;
  source: {
    extensionVersion: string;
    browser: string;
  };
  options: {
    includeHidden: boolean;
  };
  stats: {
    totalItems: number;
    favoriteCount: number;
    hiddenCount: number;
  };
  items: ExportedItem[];
}

import { isCapturableUrl } from '@/lib/utils/url';
import type { BmblExport, ExportedItem } from '@/lib/export/types';
import type { ValidationResult } from './types';
import { parseNetscapeBookmarks, isNetscapeBookmarkHtml } from './parseHtml';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_EXTENSIONS = ['.json', '.html', '.htm'];

/**
 * Validate an import file and parse its contents
 * Supports both bmbl JSON exports and Netscape HTML bookmark files
 */
export function validateImportFile(file: File): Promise<ValidationResult> {
  return new Promise((resolve) => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      resolve({
        valid: false,
        data: null,
        errors: [`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit`],
        warnings: [],
        stats: { totalItems: 0, validItems: 0, invalidItems: 0, duplicateUrls: 0 },
      });
      return;
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    const isJson = fileName.endsWith('.json');
    const isHtml = fileName.endsWith('.html') || fileName.endsWith('.htm');

    if (!isJson && !isHtml) {
      resolve({
        valid: false,
        data: null,
        errors: [`Unsupported file type. Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`],
        warnings: [],
        stats: { totalItems: 0, validItems: 0, invalidItems: 0, duplicateUrls: 0 },
      });
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;

      if (isJson) {
        resolve(validateJsonContent(content));
      } else {
        resolve(validateHtmlContent(content));
      }
    };

    reader.onerror = () => {
      resolve({
        valid: false,
        data: null,
        errors: ['Failed to read file'],
        warnings: [],
        stats: { totalItems: 0, validItems: 0, invalidItems: 0, duplicateUrls: 0 },
      });
    };

    reader.readAsText(file);
  });
}

/**
 * Validate JSON content and parse to BmblExport
 */
export function validateJsonContent(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return {
      valid: false,
      data: null,
      errors: ['Invalid JSON format'],
      warnings: [],
      stats: { totalItems: 0, validItems: 0, invalidItems: 0, duplicateUrls: 0 },
    };
  }

  // Validate structure
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      data: null,
      errors: ['Invalid export format: expected object'],
      warnings: [],
      stats: { totalItems: 0, validItems: 0, invalidItems: 0, duplicateUrls: 0 },
    };
  }

  const exportData = data as Record<string, unknown>;

  // Check version
  if (exportData.version !== 1) {
    errors.push(`Unsupported export version: ${exportData.version}. Expected version 1.`);
  }

  // Check items array
  if (!Array.isArray(exportData.items)) {
    return {
      valid: false,
      data: null,
      errors: ['Invalid export format: missing items array'],
      warnings: [],
      stats: { totalItems: 0, validItems: 0, invalidItems: 0, duplicateUrls: 0 },
    };
  }

  const items = exportData.items as unknown[];
  if (items.length === 0) {
    return {
      valid: false,
      data: null,
      errors: ['Export file contains no items'],
      warnings: [],
      stats: { totalItems: 0, validItems: 0, invalidItems: 0, duplicateUrls: 0 },
    };
  }

  // Validate each item
  let validItems = 0;
  let invalidItems = 0;
  const seenUrls = new Set<string>();
  let duplicateUrls = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as Record<string, unknown>;

    // Check required fields
    if (!item.url || typeof item.url !== 'string') {
      errors.push(`Item ${i + 1}: missing or invalid URL`);
      invalidItems++;
      continue;
    }

    // Validate URL is capturable
    if (!isCapturableUrl(item.url)) {
      errors.push(`Item ${i + 1}: URL not supported (must be http/https): ${item.url}`);
      invalidItems++;
      continue;
    }

    // Check for duplicates within file
    if (seenUrls.has(item.url)) {
      duplicateUrls++;
      // Don't count as invalid, but warn
      if (duplicateUrls <= 5) {
        warnings.push(`Duplicate URL in file: ${item.url}`);
      }
    } else {
      seenUrls.add(item.url);
    }

    // Warn on missing title
    if (!item.title || typeof item.title !== 'string') {
      if (warnings.length < 10) {
        warnings.push(`Item ${i + 1}: missing title, will use URL as fallback`);
      }
    }

    validItems++;
  }

  if (duplicateUrls > 5) {
    warnings.push(`...and ${duplicateUrls - 5} more duplicate URLs`);
  }

  // Determine validity
  const valid = errors.length === 0 && validItems > 0;

  return {
    valid,
    data: valid ? (exportData as unknown as BmblExport) : null,
    errors,
    warnings,
    stats: {
      totalItems: items.length,
      validItems,
      invalidItems,
      duplicateUrls,
    },
  };
}

/**
 * Validate HTML content and convert to BmblExport format
 */
export function validateHtmlContent(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if it looks like a bookmark file
  if (!isNetscapeBookmarkHtml(content)) {
    return {
      valid: false,
      data: null,
      errors: ['File does not appear to be a browser bookmark export. Expected Netscape bookmark HTML format.'],
      warnings: [],
      stats: { totalItems: 0, validItems: 0, invalidItems: 0, duplicateUrls: 0 },
    };
  }

  // Parse the HTML
  const bookmarks = parseNetscapeBookmarks(content);

  if (bookmarks.length === 0) {
    return {
      valid: false,
      data: null,
      errors: ['No valid bookmarks found in file. Only http/https URLs are imported.'],
      warnings: [],
      stats: { totalItems: 0, validItems: 0, invalidItems: 0, duplicateUrls: 0 },
    };
  }

  // Check for duplicates and build items
  const seenUrls = new Set<string>();
  let duplicateUrls = 0;
  const items: ExportedItem[] = [];

  for (const bookmark of bookmarks) {
    if (seenUrls.has(bookmark.url)) {
      duplicateUrls++;
      if (duplicateUrls <= 5) {
        warnings.push(`Duplicate URL in file: ${bookmark.url}`);
      }
      continue; // Skip duplicates
    }
    seenUrls.add(bookmark.url);

    // Warn on missing title
    if (!bookmark.title) {
      if (warnings.length < 10) {
        warnings.push(`Bookmark missing title: ${bookmark.url}`);
      }
    }

    items.push({
      url: bookmark.url,
      title: bookmark.title || '',
      createdAt: bookmark.addDate || undefined,
      lastSavedAt: bookmark.addDate || undefined,
      saveCount: 1,
    });
  }

  if (duplicateUrls > 5) {
    warnings.push(`...and ${duplicateUrls - 5} more duplicate URLs`);
  }

  // Add info about HTML import limitations
  warnings.unshift('Importing from browser bookmarks: only URL, title, and date are preserved.');

  // Build BmblExport-compatible structure
  const exportData: BmblExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: {
      extensionVersion: '0.0.0',
      browser: 'html-import',
    },
    options: {
      includeHidden: false,
    },
    stats: {
      totalItems: items.length,
      favoriteCount: 0,
      hiddenCount: 0,
    },
    items,
  };

  return {
    valid: true,
    data: exportData,
    errors,
    warnings,
    stats: {
      totalItems: bookmarks.length,
      validItems: items.length,
      invalidItems: 0,
      duplicateUrls,
    },
  };
}

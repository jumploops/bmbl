import { isCapturableUrl } from '@/lib/utils/url';
import type { BmblExport } from '@/lib/export/types';
import type { ValidationResult } from './types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate an import file and parse its contents
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

    // Check file type
    if (!file.name.endsWith('.json')) {
      resolve({
        valid: false,
        data: null,
        errors: ['File must be a .json file'],
        warnings: [],
        stats: { totalItems: 0, validItems: 0, invalidItems: 0, duplicateUrls: 0 },
      });
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(validateJsonContent(content));
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

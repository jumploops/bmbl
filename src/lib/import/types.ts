import type { BmblExport } from '@/lib/export/types';

export interface ImportOptions {
  conflictStrategy: 'skip' | 'merge';
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  merged: number;
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  data: BmblExport | null;
  errors: string[];
  warnings: string[];
  stats: {
    totalItems: number;
    validItems: number;
    invalidItems: number;
    duplicateUrls: number;
  };
}

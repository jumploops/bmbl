import { useState, useCallback, useRef } from 'react';
import {
  exportToJson,
  exportToBlob,
  triggerDownload,
  generateExportFilename,
  type ExportOptions,
} from '@/lib/export';
import {
  validateImportFile,
  importFromJson,
  type ImportOptions,
  type ImportResult,
  type ValidationResult,
} from '@/lib/import';

type Status = 'idle' | 'exporting' | 'validating' | 'importing' | 'success' | 'error';

interface UseImportExportReturn {
  // Export
  exportBookmarks: (options: ExportOptions) => Promise<void>;
  isExporting: boolean;

  // Import
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  openFilePicker: () => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  validation: ValidationResult | null;
  clearValidation: () => void;
  confirmImport: (options: ImportOptions) => Promise<void>;
  isValidating: boolean;
  isImporting: boolean;

  // Status
  status: Status;
  message: string | null;
  clearMessage: () => void;
}

export function useImportExport(): UseImportExportReturn {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
    setStatus('idle');
  }, []);

  const clearValidation = useCallback(() => {
    setValidation(null);
    setStatus('idle');
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Export
  const exportBookmarks = useCallback(async (options: ExportOptions) => {
    setStatus('exporting');
    setMessage(null);

    try {
      const data = await exportToJson(options);
      const blob = exportToBlob(data);
      const filename = generateExportFilename();
      triggerDownload(blob, filename);

      setStatus('success');
      setMessage(`Exported ${data.stats.totalItems} bookmarks`);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Export failed');
    }
  }, []);

  // Import - open file picker
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Import - handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('validating');
    setMessage(null);
    setValidation(null);

    const result = await validateImportFile(file);
    setValidation(result);
    setStatus(result.valid ? 'idle' : 'error');
  }, []);

  // Import - confirm and execute
  const confirmImport = useCallback(async (options: ImportOptions) => {
    if (!validation?.data) {
      setStatus('error');
      setMessage('No valid data to import');
      return;
    }

    setStatus('importing');
    setMessage(null);

    try {
      const result: ImportResult = await importFromJson(validation.data, options);

      if (result.success) {
        const parts: string[] = [];
        if (result.imported > 0) parts.push(`${result.imported} imported`);
        if (result.merged > 0) parts.push(`${result.merged} merged`);
        if (result.skipped > 0) parts.push(`${result.skipped} skipped`);

        setStatus('success');
        setMessage(parts.join(', ') || 'Import complete');
        setValidation(null);

        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setStatus('error');
        setMessage(result.errors.join(', ') || 'Import failed');
      }
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Import failed');
    }
  }, [validation]);

  return {
    // Export
    exportBookmarks,
    isExporting: status === 'exporting',

    // Import
    fileInputRef,
    openFilePicker,
    handleFileSelect,
    validation,
    clearValidation,
    confirmImport,
    isValidating: status === 'validating',
    isImporting: status === 'importing',

    // Status
    status,
    message,
    clearMessage,
  };
}

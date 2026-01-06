import { useState, useCallback } from 'react';
import { clearAllData, getDataCounts, type ClearResult, type DataCounts } from '@/lib/db/clear';

interface UseDeleteAllDataReturn {
  // Modal state
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;

  // Data counts (for confirmation message)
  counts: DataCounts | null;
  isLoadingCounts: boolean;

  // Delete action
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;

  // Result
  result: ClearResult | null;
  clearResult: () => void;
}

export function useDeleteAllData(): UseDeleteAllDataReturn {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [counts, setCounts] = useState<DataCounts | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [result, setResult] = useState<ClearResult | null>(null);

  const openModal = useCallback(async () => {
    setIsModalOpen(true);
    setIsLoadingCounts(true);
    setResult(null);

    try {
      const dataCounts = await getDataCounts();
      setCounts(dataCounts);
    } catch {
      setCounts({ items: 0, captures: 0, captureEvents: 0 });
    } finally {
      setIsLoadingCounts(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    if (!isDeleting) {
      setIsModalOpen(false);
      setCounts(null);
    }
  }, [isDeleting]);

  const confirmDelete = useCallback(async () => {
    setIsDeleting(true);

    try {
      const deleteResult = await clearAllData();
      setResult(deleteResult);

      if (deleteResult.success) {
        setIsModalOpen(false);
        setCounts(null);
      }
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    isModalOpen,
    openModal,
    closeModal,
    counts,
    isLoadingCounts,
    confirmDelete,
    isDeleting,
    result,
    clearResult,
  };
}

import { useEffect } from 'react';

/**
 * Listens for capture completion by watching chrome.storage.local changes.
 * This is more reliable than chrome.runtime.sendMessage for MV3 extensions,
 * as storage changes are guaranteed to fire in all extension contexts.
 */
export function useCaptureListener(onCaptureComplete: () => void): void {
  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.lastCaptureTime) {
        onCaptureComplete();
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [onCaptureComplete]);
}

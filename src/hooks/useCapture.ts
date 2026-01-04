import { useState, useCallback } from 'react';
import type { CaptureResult } from '@/types';

interface UseCaptureReturn {
  capture: () => Promise<CaptureResult | null>;
  isCapturing: boolean;
  lastResult: CaptureResult | null;
  error: string | null;
}

export function useCapture(): UseCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastResult, setLastResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async (): Promise<CaptureResult | null> => {
    if (isCapturing) return null;

    setIsCapturing(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_ALL_TABS' });

      if (response?.error) {
        setError(response.error);
        return null;
      }

      setLastResult(response as CaptureResult);
      return response as CaptureResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Capture failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  return { capture, isCapturing, lastResult, error };
}

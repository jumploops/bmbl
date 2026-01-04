import { useState, useEffect } from 'react';
import type { Capture } from '@/types';

export function useLastCapture(): Capture | null {
  const [lastCapture, setLastCapture] = useState<Capture | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_LAST_CAPTURE' })
      .then((capture) => {
        setLastCapture(capture || null);
      })
      .catch((error) => {
        console.error('Failed to get last capture:', error);
      });
  }, []);

  return lastCapture;
}

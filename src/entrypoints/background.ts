import { captureAllTabs, isCaptureInProgress } from '@/lib/capture/capture';
import { resetIcon, handleIconResetAlarm, ICON_RESET_ALARM } from '@/lib/capture/icons';
import { initializeSettings } from '@/lib/settings';
import { getLastCapture } from '@/lib/db/captures';
import type { Message } from '@/types';

export default defineBackground(() => {
  // Initialize settings on install
  chrome.runtime.onInstalled.addListener(async () => {
    await initializeSettings();
    await resetIcon();
  });

  // Handle icon reset alarm (safety net for when service worker was terminated)
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ICON_RESET_ALARM) {
      await handleIconResetAlarm();
    }
  });

  // Handle toolbar icon click
  chrome.action.onClicked.addListener(async () => {
    if (isCaptureInProgress()) {
      return;
    }

    try {
      await captureAllTabs();

      // Signal capture complete via storage (for live refresh in new tab pages)
      await chrome.storage.local.set({ lastCaptureTime: Date.now() });
    } catch (error) {
      console.error('Capture failed:', error);
      await resetIcon();
    }
  });

  // Handle messages from new tab page
  chrome.runtime.onMessage.addListener(
    (message: Message, _sender, sendResponse): boolean => {
      if (message.type === 'CAPTURE_ALL_TABS') {
        if (isCaptureInProgress()) {
          sendResponse({ error: 'Capture already in progress' });
          return false;
        }

        // Async handler
        captureAllTabs()
          .then((result) => {
            sendResponse(result);
          })
          .catch((error) => {
            console.error('Capture failed:', error);
            sendResponse({ error: error.message });
          });

        // Return true to indicate async response
        return true;
      }

      if (message.type === 'GET_LAST_CAPTURE') {
        getLastCapture()
          .then((capture) => {
            sendResponse(capture || null);
          })
          .catch((error) => {
            console.error('Failed to get last capture:', error);
            sendResponse(null);
          });

        return true;
      }

      return false;
    }
  );
});

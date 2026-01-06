type IconState = 'default' | 'loading' | 'success';

export const ICON_RESET_ALARM = 'icon-reset';
const SUCCESS_DISPLAY_MS = 5000;
const ALARM_DELAY_MINUTES = 0.5; // 30 seconds (Chrome minimum for packed extensions)

const ICON_PATHS: Record<IconState, Record<number, string>> = {
  default: {
    16: 'icon/16.png',
    32: 'icon/32.png',
    48: 'icon/48.png',
    128: 'icon/128.png',
  },
  loading: {
    16: 'icon/loading-16.png',
    32: 'icon/loading-32.png',
    48: 'icon/loading-48.png',
    128: 'icon/loading-128.png',
  },
  success: {
    16: 'icon/success-16.png',
    32: 'icon/success-32.png',
    48: 'icon/success-48.png',
    128: 'icon/success-128.png',
  },
};

let successTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Clear any pending icon reset mechanisms (both setTimeout and alarm)
 */
async function clearPendingReset(): Promise<void> {
  if (successTimeout) {
    clearTimeout(successTimeout);
    successTimeout = null;
  }
  await chrome.alarms.clear(ICON_RESET_ALARM);
}

/**
 * Set the extension icon state.
 * For 'success' state, schedules automatic reset to 'default' using:
 * - setTimeout (5 sec) for fast reset when service worker stays alive
 * - chrome.alarms (30 sec) as safety net if service worker terminates
 */
export async function setIconState(state: IconState): Promise<void> {
  await clearPendingReset();

  await chrome.action.setIcon({
    path: ICON_PATHS[state],
  });

  if (state === 'success') {
    // Fast path: setTimeout (works if service worker stays alive)
    successTimeout = setTimeout(async () => {
      await chrome.alarms.clear(ICON_RESET_ALARM);
      await chrome.action.setIcon({ path: ICON_PATHS.default });
      successTimeout = null;
    }, SUCCESS_DISPLAY_MS);

    // Safety net: alarm (fires if service worker was terminated)
    await chrome.alarms.create(ICON_RESET_ALARM, {
      delayInMinutes: ALARM_DELAY_MINUTES,
    });
  }
}

/**
 * Handle icon reset alarm firing (called from background.ts alarm listener)
 */
export async function handleIconResetAlarm(): Promise<void> {
  if (successTimeout) {
    clearTimeout(successTimeout);
    successTimeout = null;
  }
  await chrome.action.setIcon({ path: ICON_PATHS.default });
}

/**
 * Set icon to default state
 */
export async function resetIcon(): Promise<void> {
  await setIconState('default');
}

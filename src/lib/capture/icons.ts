type IconState = 'default' | 'loading' | 'success';

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
 * Set the extension icon state
 */
export async function setIconState(state: IconState): Promise<void> {
  // Clear any pending success timeout
  if (successTimeout) {
    clearTimeout(successTimeout);
    successTimeout = null;
  }

  await chrome.action.setIcon({
    path: ICON_PATHS[state],
  });

  // If success, revert to default after 5 seconds
  if (state === 'success') {
    successTimeout = setTimeout(() => {
      chrome.action.setIcon({ path: ICON_PATHS.default });
      successTimeout = null;
    }, 5000);
  }
}

/**
 * Set icon to default state
 */
export async function resetIcon(): Promise<void> {
  await setIconState('default');
}

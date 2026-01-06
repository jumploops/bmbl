# Plan: Replace setTimeout with chrome.alarms for Icon State

**Date**: 2026-01-05
**Status**: Draft
**Related**: `review/001-codebase-audit.md` (Item #3, Performance M2)

---

## Problem Statement

In `src/lib/capture/icons.ts`, we use `setTimeout` to revert the extension icon from 'success' back to 'default' after 5 seconds:

```typescript
if (state === 'success') {
  successTimeout = setTimeout(() => {
    chrome.action.setIcon({ path: ICON_PATHS.default });
    successTimeout = null;
  }, 5000);
}
```

**The issue**: In Manifest V3 (MV3), service workers can be terminated by Chrome at any time when idle. If the service worker is terminated while the `setTimeout` is pending:

1. The timeout callback never fires
2. The icon remains stuck in 'success' state indefinitely
3. The `successTimeout` variable is lost when the worker restarts

This creates a poor user experience where the success icon persists until the user manually triggers another action.

---

## Chrome Alarms API: Constraints

The `chrome.alarms` API is designed for reliable deferred execution in MV3 service workers. However, it has important constraints:

| Parameter | Minimum Value | Notes |
|-----------|---------------|-------|
| `delayInMinutes` | **0.5 min (30 sec)** | For packed extensions |
| `periodInMinutes` | 0.5 min (30 sec) | For repeating alarms |
| Unpacked (dev) | No minimum | During development only |

**Key insight**: We cannot achieve the current 5-second delay using `chrome.alarms` alone in production. The minimum is 30 seconds.

---

## Solution Options

### Option A: Accept 30-Second Delay
Use `chrome.alarms` with the minimum 0.5 minute delay.

**Pros:**
- Simple implementation
- Guaranteed reliability
- Single mechanism to maintain

**Cons:**
- Icon stays in 'success' state for 30 seconds (6x longer than current)
- May feel sluggish to users

### Option B: Hybrid Approach (Recommended)
Use `setTimeout` for the fast path, with `chrome.alarms` as a safety net.

```
User clicks icon
    ↓
Set icon to 'success'
    ↓
├── Start setTimeout (5 sec) ──→ Reset icon, cancel alarm
│
└── Create alarm (30 sec) ─────→ Reset icon (if setTimeout didn't fire)
```

**Pros:**
- Fast 5-second reset in the common case (worker stays alive)
- Guaranteed reset within 30 seconds even if worker dies
- Best user experience

**Cons:**
- Two mechanisms to manage
- Slightly more complex code

### Option C: Storage-Based State Recovery
Store icon state in `chrome.storage.session` and check on worker wake-up.

**Pros:**
- Can achieve any delay
- Persists state across worker restarts

**Cons:**
- Relies on worker waking up (no guaranteed trigger)
- More complex state management
- Race conditions possible

### Option D: Reset on Next User Action
Don't auto-reset; reset when user interacts with extension again.

**Pros:**
- Simplest implementation
- No timing concerns

**Cons:**
- Icon may stay in 'success' state for hours
- Poor user experience

---

## Recommended Approach: Option B (Hybrid)

The hybrid approach provides the best balance:

1. **Normal case** (95%+): Service worker stays alive, `setTimeout` fires at 5 seconds, user sees quick feedback
2. **Edge case**: Service worker terminates, alarm fires at 30 seconds, icon eventually resets

### Implementation Details

#### 1. Add `alarms` Permission

**File**: `wxt.config.ts`

```typescript
permissions: [
  'tabs',
  'tabGroups',
  'storage',
  'unlimitedStorage',
  'alarms',  // Add this
],
```

#### 2. Refactor `icons.ts`

**File**: `src/lib/capture/icons.ts`

```typescript
type IconState = 'default' | 'loading' | 'success';

const ALARM_NAME = 'icon-reset';
const SUCCESS_DISPLAY_MS = 5000;
const ALARM_DELAY_MINUTES = 0.5; // 30 seconds (Chrome minimum)

const ICON_PATHS: Record<IconState, Record<number, string>> = {
  // ... unchanged
};

let successTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Clear any pending icon reset mechanisms
 */
async function clearPendingReset(): Promise<void> {
  // Clear setTimeout
  if (successTimeout) {
    clearTimeout(successTimeout);
    successTimeout = null;
  }

  // Clear alarm
  await chrome.alarms.clear(ALARM_NAME);
}

/**
 * Set the extension icon state
 */
export async function setIconState(state: IconState): Promise<void> {
  // Clear any pending reset
  await clearPendingReset();

  await chrome.action.setIcon({
    path: ICON_PATHS[state],
  });

  // If success, schedule reset to default
  if (state === 'success') {
    // Fast path: setTimeout (works if worker stays alive)
    successTimeout = setTimeout(async () => {
      await chrome.alarms.clear(ALARM_NAME); // Cancel the safety net
      await chrome.action.setIcon({ path: ICON_PATHS.default });
      successTimeout = null;
    }, SUCCESS_DISPLAY_MS);

    // Safety net: alarm (fires if worker was terminated)
    await chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: ALARM_DELAY_MINUTES,
    });
  }
}

/**
 * Handle alarm firing (called from background.ts)
 */
export async function handleIconResetAlarm(): Promise<void> {
  // Clear the setTimeout if it somehow still exists
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
```

#### 3. Register Alarm Listener in Background

**File**: `src/entrypoints/background.ts`

```typescript
import { captureAllTabs, isCaptureInProgress } from '@/lib/capture/capture';
import { resetIcon, handleIconResetAlarm } from '@/lib/capture/icons';
// ... other imports

const ICON_RESET_ALARM = 'icon-reset';

export default defineBackground(() => {
  // ... existing code ...

  // Handle icon reset alarm
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ICON_RESET_ALARM) {
      await handleIconResetAlarm();
    }
  });
});
```

---

## Potential Issues & Mitigations

### Issue 1: Alarm Name Collision
If we add more alarms later, name collisions could occur.

**Mitigation**: Use a constant `ALARM_NAME = 'icon-reset'` and export it or use a naming convention like `bmbl:icon-reset`.

### Issue 2: Race Condition Between setTimeout and Alarm
Both could theoretically fire in quick succession.

**Mitigation**: The `clearPendingReset()` function and idempotent nature of `setIcon` prevent issues. Setting the icon to 'default' twice is harmless.

### Issue 3: Alarm Permissions in Development
During development with unpacked extensions, alarms have no minimum delay. This means behavior differs between dev and prod.

**Mitigation**: Document this difference. Consider using a longer test delay in dev to simulate prod behavior:
```typescript
const ALARM_DELAY_MINUTES = import.meta.env.DEV ? 0.1 : 0.5;
```

### Issue 4: Multiple Rapid Captures
If user clicks rapidly, multiple alarms/timeouts could queue up.

**Mitigation**: `clearPendingReset()` cancels both mechanisms before setting new ones. Each capture clears the previous reset schedule.

### Issue 5: Service Worker Cold Start
On first load after install/update, no alarm listener exists until `defineBackground` runs.

**Mitigation**: Not an issue for our use case - alarms can only be created after the background script runs, so the listener will always exist when alarms fire.

---

## Testing Plan

### Manual Testing

1. **Normal flow**:
   - Click extension icon
   - Verify icon changes to 'loading', then 'success'
   - Wait 5 seconds, verify icon returns to default

2. **Service worker termination** (simulate):
   - Click extension icon
   - Immediately navigate to `chrome://serviceworker-internals/`
   - Find and stop the bmbl service worker
   - Wait 30 seconds, verify icon eventually resets

3. **Rapid clicking**:
   - Click icon multiple times in quick succession
   - Verify only one reset occurs (no visual glitches)

4. **Permission verification**:
   - Check `chrome://extensions` → bmbl → Permissions
   - Verify "alarms" permission is listed

### Automated Testing

Unit testing chrome.alarms is challenging since it requires the Chrome extension environment. Consider:
- Mock `chrome.alarms` in tests
- Integration tests using Puppeteer/Playwright with extension support

---

## Files Changed

| File | Change |
|------|--------|
| `wxt.config.ts` | Add `alarms` permission |
| `src/lib/capture/icons.ts` | Add alarm creation, export handler |
| `src/entrypoints/background.ts` | Add alarm listener |

---

## Rollback Plan

If issues arise:
1. Remove alarm listener from `background.ts`
2. Remove `alarms` permission from `wxt.config.ts`
3. Revert `icons.ts` to setTimeout-only approach

The fallback is the current behavior (occasional stuck icon), which is annoying but not breaking.

---

## Decision

**Recommended**: Option B (Hybrid Approach)

This provides the best user experience with reliable fallback behavior. The slight complexity increase is justified by the improved robustness.

**Trade-off accepted**: In the rare case where the service worker is terminated during the success display, users will see the success icon for up to 30 seconds instead of 5 seconds. This is acceptable given the alternative (icon stuck forever).

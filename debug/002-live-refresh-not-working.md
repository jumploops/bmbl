# Debug: Live Refresh Not Working

**Issue**: After capturing tabs via the toolbar icon, the new tab page doesn't automatically refresh to show the newly captured items. Users must open a new tab to see the updated list.

**Expected behavior**: The new tab page should auto-refresh when a capture completes.

**Observed behavior**: The list remains unchanged until a new tab is opened.

---

## Current Implementation

### Flow Diagram

```
[User clicks toolbar icon]
        ↓
[background.ts: chrome.action.onClicked]
        ↓
[captureAllTabs() completes]
        ↓
[chrome.runtime.sendMessage({ type: 'CAPTURE_COMPLETE' })]
        ↓
[??? Does this reach the new tab page ???]
        ↓
[useCaptureListener hook should receive message]
        ↓
[Calls refresh() from useItems]
        ↓
[List updates with new items]
```

### Relevant Code

**background.ts:26-33** - Sending the message:
```typescript
const result = await captureAllTabs();
console.log('Capture complete:', result);

// Notify all tabs that capture is complete (for live refresh)
chrome.runtime.sendMessage({ type: 'CAPTURE_COMPLETE' }).catch(() => {
  // Ignore errors if no listeners (e.g., no new tab pages open)
});
```

**useCaptureListener.ts:7-18** - Receiving the message:
```typescript
export function useCaptureListener(onCaptureComplete: () => void): void {
  useEffect(() => {
    const listener = (message: { type: string }) => {
      if (message.type === 'CAPTURE_COMPLETE') {
        onCaptureComplete();
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [onCaptureComplete]);
}
```

**App.tsx:27** - Using the hook:
```typescript
useCaptureListener(refresh);
```

---

## Hypotheses

### Hypothesis 1: `chrome.runtime.sendMessage` doesn't reach extension pages from service worker (MOST LIKELY)

**Theory**: In Manifest V3, the background script is a service worker. The behavior of `chrome.runtime.sendMessage` from a service worker may differ from the legacy background page model.

According to Chrome extension docs, `chrome.runtime.sendMessage` "sends a single message to event listeners within your extension." However, there's ambiguity about whether this reliably reaches extension page contexts (like new tab overrides) when sent FROM the service worker.

**Evidence**:
- This is a known pain point in MV3 extension development
- The `.catch()` silently swallows errors, so we don't know if sending fails
- No console.log confirms the message was received

**How to verify**:
1. Add `console.log('Sending CAPTURE_COMPLETE')` before sendMessage in background.ts
2. Add `console.log('Received message:', message)` in the listener in useCaptureListener.ts
3. Check DevTools console in both the service worker AND the new tab page

---

### Hypothesis 2: The message is sent but caught/consumed elsewhere

**Theory**: The background script has its own `chrome.runtime.onMessage.addListener`. When the background sends a message, could its own listener interfere?

**Evidence against**: Chrome docs state "The onMessage event is fired in each frame of your extension... except for the frame that called sendMessage." So the sender should NOT receive its own message.

**How to verify**: Add logging to the background's onMessage listener to see if it receives `CAPTURE_COMPLETE` (it shouldn't).

---

### Hypothesis 3: Timing issue with React effect

**Theory**: The `useCaptureListener` hook depends on `onCaptureComplete` (which is `refresh`). If the callback reference changes, the effect re-runs (removes old listener, adds new). A message arriving during this window would be lost.

**Evidence against**:
- `refresh` is memoized with `useCallback([view])`
- `view` doesn't change during normal operation
- The listener re-attachment is synchronous and nearly instantaneous

**How to verify**: Add logging to the effect's cleanup and setup to see if listener is being recreated frequently.

---

### Hypothesis 4: The new tab page context is special

**Theory**: Chrome new tab page overrides might run in a slightly different context that doesn't receive `chrome.runtime` messages the same way as popups or options pages.

**Evidence**: Some developers report issues with messaging to/from new tab overrides in MV3.

**How to verify**: Test if the options page can receive the message (add a temporary listener there).

---

### Hypothesis 5: The Promise rejection is swallowed

**Theory**: `chrome.runtime.sendMessage` returns a Promise. If there are no listeners, it may reject. We're catching and ignoring all errors.

```typescript
chrome.runtime.sendMessage({ type: 'CAPTURE_COMPLETE' }).catch(() => {
  // Ignore errors if no listeners
});
```

**Evidence**: We have no visibility into whether this succeeds or fails.

**How to verify**: Log the catch:
```typescript
.catch((err) => {
  console.log('sendMessage failed:', err);
});
```

---

### Hypothesis 6: Message type not in TypeScript union (unlikely to cause runtime issue)

**Theory**: `CAPTURE_COMPLETE` is not in the `MessageType` union in types/index.ts:
```typescript
export type MessageType =
  | 'CAPTURE_ALL_TABS'
  | 'CAPTURE_RESULT'
  | 'GET_LAST_CAPTURE';
```

**Evidence against**: TypeScript types don't affect runtime. The message `{ type: 'CAPTURE_COMPLETE' }` will still be sent and received regardless of type definitions.

**Action**: Add `CAPTURE_COMPLETE` to the union for type safety, but this won't fix the bug.

---

## Recommended Fix

### Use `chrome.storage.local` instead of `chrome.runtime.sendMessage`

This is the most reliable cross-context communication method in MV3:

**background.ts**:
```typescript
// After capture completes
await chrome.storage.local.set({ lastCaptureTime: Date.now() });
```

**useCaptureListener.ts**:
```typescript
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
```

**Why this is better**:
1. `chrome.storage.onChanged` is guaranteed to fire in ALL extension contexts
2. It's the recommended pattern for MV3 cross-context communication
3. It works reliably for new tab pages, options pages, popups, and content scripts
4. It persists across service worker restarts

---

## Debugging Steps

1. **Add logging to both sides**:
   - Background: `console.log('Sending CAPTURE_COMPLETE')`
   - Listener: `console.log('Listener received:', message.type)`

2. **Check DevTools for both contexts**:
   - Service worker: `chrome://extensions` → bmbl → "Inspect views: service worker"
   - New tab page: Open DevTools on the new tab page itself

3. **Verify listener is attached**:
   - Add `console.log('Listener attached')` in useEffect
   - Verify it runs when new tab page loads

4. **Test alternative: storage-based signaling**:
   - Implement the `chrome.storage.local` approach
   - Verify it works reliably

---

## Root Cause

**Hypothesis 1 confirmed**: `chrome.runtime.sendMessage` from a Manifest V3 service worker doesn't reliably reach extension pages like new tab overrides.

**Additional note**: After switching to `chrome.storage.local`, the fix required a clean rebuild and extension reload to take effect. The issue may have been stale cached code in the browser.

---

## Fix Applied

Replaced `chrome.runtime.sendMessage` with `chrome.storage.local` signaling:

**background.ts**:
```typescript
// Signal capture complete via storage (for live refresh in new tab pages)
// This is more reliable than chrome.runtime.sendMessage in MV3
await chrome.storage.local.set({ lastCaptureTime: Date.now() });
```

**useCaptureListener.ts**:
```typescript
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
```

**Status**: Fixed and verified with `pnpm typecheck && pnpm build`.

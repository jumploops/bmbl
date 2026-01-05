# Debug: Light Mode Not Applying to Settings Page Elements

**Issue**: When user selects "Light" theme in settings, the dropdown buttons (Select components) and the troubleshooting block still display with dark backgrounds.

**Expected behavior**: In light mode, dropdowns should have light/white backgrounds with dark text. The troubleshooting block should have a light gray (`bg-gray-50`) background.

**Observed behavior**:
- Dropdowns show dark backgrounds with light text (legible but inverted)
- Troubleshooting block shows dark background

---

## Current Implementation

### Theme Setting Flow

```
[User selects "Light" in Theme dropdown]
        ↓
[Select.onChange → updateSetting('darkMode', 'light')]
        ↓
[useSettings: optimistic update → setSettings({...prev, darkMode: 'light'})]
        ↓
[Component re-renders with settings.darkMode = 'light']
        ↓
[useDarkMode('light') called]
        ↓
[isDark = false (because preference === 'light')]
        ↓
[useEffect runs: document.documentElement.classList.remove('dark')]
        ↓
[Tailwind dark: variants should no longer apply]
        ↓
[bg-white should apply instead of dark:bg-gray-800]
```

### Relevant Code

**useDarkMode.ts**:
```typescript
export function useDarkMode(preference: DarkMode = 'system'): boolean {
  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Determine actual dark mode state
  const isDark =
    preference === 'dark' ? true :
    preference === 'light' ? false :
    systemIsDark;

  // Apply class to document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return isDark;
}
```

**Select.tsx**:
```typescript
<select
  className={cn(
    'border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm cursor-pointer',
    'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
    ...
  )}
>
```

**globals.css**:
```css
:root {
  color-scheme: light;
  /* light mode variables */
}

.dark {
  color-scheme: dark;
  /* dark mode variables */
}
```

---

## Hypotheses

### Hypothesis 1: The `dark` class is not being removed from `<html>` (MOST LIKELY)

**Theory**: When the user selects light mode, the `document.documentElement.classList.remove('dark')` call either:
- Is not being executed at all
- Is being executed but something is re-adding the class
- Is being overridden by another mechanism

**Evidence for**:
- Both dropdowns AND the troubleshooting block show dark styling
- This suggests a global issue (the `dark` class) rather than component-specific styling
- The `dark:` variants are clearly being applied (dark backgrounds visible)

**How to verify**:
1. Add `console.log` in useDarkMode effect to confirm it runs
2. Log `document.documentElement.classList` before and after removal
3. Check DevTools Elements panel to see if `dark` class is on `<html>`

---

### Hypothesis 2: The useDarkMode hook receives stale `preference` value

**Theory**: Due to React closure or re-render timing, the hook might be receiving the old preference value even after settings update.

**Evidence against**:
- `useDarkMode(settings.darkMode)` is called directly with the current settings value
- React should pass the new value on each render

**How to verify**:
1. Log `preference` parameter in useDarkMode
2. Log `settings.darkMode` in App component on each render

---

### Hypothesis 3: The `isDark` value doesn't change when preference changes

**Theory**: If the previous `isDark` was `false` and the new `isDark` is also `false`, the useEffect won't run (no dependency change).

**Scenario where this happens**:
- System preference is light
- User has `darkMode: 'system'` → `isDark = false`
- User switches to `darkMode: 'light'` → `isDark = false` (no change!)
- Effect doesn't run, class state is preserved from initial load

Wait, but if system is light and `isDark` was always `false`, then `dark` class was never added...

**Unless**: On initial page load with system in dark mode:
1. Settings load with `DEFAULT_SETTINGS.darkMode = 'system'`
2. System is dark → `isDark = true` → `dark` class added
3. Actual settings load with `darkMode: 'light'`
4. `isDark = false` → effect runs → class should be removed

This should work correctly.

**How to verify**:
1. Log `isDark` value on every render
2. Check if effect runs when `isDark` changes

---

### Hypothesis 4: Settings aren't loading or persisting correctly

**Theory**: The `darkMode: 'light'` value isn't being saved to or read from chrome.storage.sync correctly.

**Evidence against**:
- User can see the dropdown is set to "Light"
- The setting appears to persist across page reloads

**How to verify**:
1. Check `chrome.storage.sync.get('settings')` in DevTools console
2. Confirm `darkMode: 'light'` is stored

---

### Hypothesis 5: Browser's `color-scheme` is overriding element backgrounds

**Theory**: When `.dark { color-scheme: dark }` was active on initial load, the browser cached dark styling for form elements. Even after removing the class, the browser continues to apply dark form element styling.

**Evidence for**:
- We just added `color-scheme` to fix the dropdowns
- Form elements (like `<select>`) are heavily browser-controlled
- The issue is specifically with form elements AND the troubleshooting block

**Evidence against**:
- The troubleshooting block is a plain `<div>`, not a form element
- `color-scheme` shouldn't affect `<div>` background colors

**How to verify**:
1. Hard refresh the page after setting to light mode
2. Check if `color-scheme: light` is active in computed styles

---

### Hypothesis 6: CSS specificity - dark mode styles are winning

**Theory**: The `dark:bg-gray-800` might have higher specificity than `bg-white` due to how Tailwind v4 generates the CSS.

**Evidence against**:
- Tailwind's dark mode classes should have equal specificity
- The class presence on `:root`/`html` determines which applies

**How to verify**:
1. Inspect computed styles in DevTools
2. Check which CSS rule is being applied
3. Look for specificity conflicts

---

### Hypothesis 7: The options page is using its own dark mode mechanism

**Theory**: Maybe something else in the options entrypoint is controlling dark mode.

**How to verify**:
1. Search for other usages of `classList.add('dark')` in the codebase
2. Check if options/index.html has any inline scripts

---

### Hypothesis 8: Multiple React roots or hydration issues

**Theory**: If there are multiple instances of the App component or hydration mismatches, the dark mode state could be inconsistent.

**Evidence against**:
- WXT creates a clean React root for each entrypoint
- No SSR/hydration involved

---

## Debugging Steps

### Step 1: Check if `dark` class is on `<html>` in light mode

1. Open extension options page
2. Set theme to "Light"
3. Open DevTools → Elements
4. Inspect the `<html>` element
5. **Expected**: No `dark` class
6. **If `dark` class is present**: Hypothesis 1 confirmed

### Step 2: Add logging to useDarkMode hook

```typescript
export function useDarkMode(preference: DarkMode = 'system'): boolean {
  console.log('[useDarkMode] preference:', preference);

  // ... existing code ...

  console.log('[useDarkMode] isDark:', isDark);

  useEffect(() => {
    console.log('[useDarkMode] Effect running, isDark:', isDark);
    console.log('[useDarkMode] classList before:',
      document.documentElement.classList.toString());

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    console.log('[useDarkMode] classList after:',
      document.documentElement.classList.toString());
  }, [isDark]);

  return isDark;
}
```

### Step 3: Check storage value

In DevTools console on options page:
```javascript
chrome.storage.sync.get('settings', console.log);
```

### Step 4: Check computed styles

1. Right-click on a Select dropdown → Inspect
2. Look at Computed tab
3. Find `background-color`
4. See which CSS rule is applying it

---

## Potential Fixes (after diagnosis)

### If Hypothesis 1 is confirmed (class not being removed):

**Fix A**: Force remove on mount
```typescript
useEffect(() => {
  // Force initial state based on preference
  if (preference === 'light') {
    document.documentElement.classList.remove('dark');
  } else if (preference === 'dark') {
    document.documentElement.classList.add('dark');
  }
}, [preference]); // Depend on preference, not isDark
```

**Fix B**: Use preference directly in effect dependency
```typescript
useEffect(() => {
  const shouldBeDark =
    preference === 'dark' ? true :
    preference === 'light' ? false :
    systemIsDark;

  if (shouldBeDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}, [preference, systemIsDark]);
```

### If it's a caching issue:

Consider calling `document.documentElement.classList.remove('dark')` unconditionally before adding it back conditionally.

---

## Notes

- The issue was introduced when we added the dark mode override setting
- Before that, dark mode was purely based on system preference
- The hook logic changed from always following system to supporting overrides

---

## Root Cause Found

**Tailwind CSS v4 is using media query strategy, not class strategy!**

When inspecting computed styles, the dark mode CSS looks like:
```css
.dark\:bg-gray-800 {
    @media (prefers-color-scheme: dark) {
        background-color: var(--color-gray-800);
    }
}
```

This means:
1. Our `useDarkMode` hook correctly adds/removes the `dark` class ✓
2. But Tailwind ignores the class entirely ✗
3. Tailwind only checks `prefers-color-scheme` media query from the OS

**Fix**: Configure Tailwind v4 to use class-based dark mode by adding a custom variant in `globals.css`:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

This tells Tailwind that `dark:` classes should match when `.dark` is present on an ancestor element, not when the system prefers dark mode.

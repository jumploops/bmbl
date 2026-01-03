# Phase 1: Project Setup & Foundation

**Goal**: Scaffold a working WXT Chrome extension with React, TypeScript, Tailwind, and ShadCN. The extension should load in Chrome with a basic new tab page and options page.

**Dependencies**: None (this is the foundation)

**Estimated scope**: Small

---

## Overview

This phase establishes the development environment and basic extension structure. By the end, we'll have:
- A WXT project with hot reload
- React + TypeScript configured
- Tailwind CSS + ShadCN UI ready
- Basic manifest with required permissions
- Placeholder new tab and options pages
- Extension icons

---

## Implementation Steps

### 1. Initialize WXT Project

```bash
npx wxt@latest init bmbl --template react
cd bmbl
```

WXT will create the basic structure. We'll customize it.

### 2. Install Dependencies

```bash
# Core dependencies (some may already be installed by WXT)
npm install react react-dom
npm install -D typescript @types/react @types/react-dom

# Styling
npm install -D tailwindcss postcss autoprefixer
npm install tailwindcss-animate class-variance-authority clsx tailwind-merge

# UI Components
npm install lucide-react
npm install date-fns

# Data layer (for Phase 2, but install now)
npm install dexie

# ShadCN CLI
npx shadcn@latest init
```

### 3. Configure Tailwind

**tailwind.config.js**
```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        // HN-style palette with purple accent
        'hn-bg': '#f6f6ef',
        'hn-header': '#7c3aed', // Purple instead of orange
        'hn-header-dark': '#5b21b6',
        'hn-text': '#000000',
        'hn-text-secondary': '#828282',
        'hn-link': '#000000',
        'hn-link-visited': '#828282',
      },
      fontFamily: {
        'hn': ['Verdana', 'Geneva', 'sans-serif'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

**src/styles/globals.css**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #f6f6ef;
  --foreground: #000000;
}

.dark {
  --background: #1a1a1a;
  --foreground: #f6f6ef;
}

body {
  font-family: Verdana, Geneva, sans-serif;
  font-size: 10pt;
  background: var(--background);
  color: var(--foreground);
}
```

### 4. Configure WXT Manifest

**wxt.config.ts**
```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Bookmark Backlog',
    short_name: 'bmbl',
    description: 'Save all tabs with one click. Triage your reading backlog.',
    version: '0.1.0',
    permissions: [
      'tabs',
      'tabGroups',
      'storage',
      'unlimitedStorage',
    ],
    action: {
      default_title: 'Save all tabs',
    },
    chrome_url_overrides: {
      newtab: 'newtab.html',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
  },
});
```

### 5. Create Project Structure

```
src/
├── entrypoints/
│   ├── background.ts           # Service worker (placeholder)
│   ├── newtab/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   └── options/
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx
├── components/
│   └── ui/                     # ShadCN components go here
├── lib/
│   ├── db/                     # Phase 2: Dexie.js
│   ├── capture/                # Phase 3: Capture logic
│   └── utils/
│       └── cn.ts               # Tailwind class merger
├── hooks/
├── types/
│   └── index.ts
└── styles/
    └── globals.css
```

### 6. Create Entry Files

**src/entrypoints/background.ts**
```ts
export default defineBackground(() => {
  console.log('bmbl background script loaded');

  // Placeholder: will handle capture in Phase 3
  browser.action.onClicked.addListener(() => {
    console.log('Toolbar icon clicked - capture will be implemented in Phase 3');
  });
});
```

**src/entrypoints/newtab/index.html**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>bmbl</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

**src/entrypoints/newtab/main.tsx**
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../../styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**src/entrypoints/newtab/App.tsx**
```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-hn-bg font-hn">
      <header className="bg-hn-header text-white px-2 py-0.5">
        <nav className="flex items-center gap-2 text-sm">
          <span className="font-bold">bmbl</span>
          <span>|</span>
          <a href="#" className="hover:underline">new</a>
          <span>|</span>
          <a href="#" className="hover:underline">old</a>
          <span>|</span>
          <a href="#" className="hover:underline">priority</a>
          <span>|</span>
          <a href="#" className="hover:underline">frequent</a>
          <span>|</span>
          <a href="#" className="hover:underline">hidden</a>
          <span>|</span>
          <a href="#" className="hover:underline">settings</a>
        </nav>
      </header>
      <main className="p-4">
        <p className="text-hn-text-secondary">
          Phase 1 complete! New Tab page placeholder.
        </p>
      </main>
    </div>
  );
}
```

**src/entrypoints/options/index.html**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>bmbl Settings</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

**src/entrypoints/options/main.tsx**
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../../styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**src/entrypoints/options/App.tsx**
```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-hn-bg font-hn p-4">
      <h1 className="text-lg font-bold mb-4">bmbl Settings</h1>
      <p className="text-hn-text-secondary">
        Phase 1 complete! Settings page placeholder.
      </p>
    </div>
  );
}
```

### 7. Utility Functions

**src/lib/utils/cn.ts**
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 8. Create Extension Icons

Create placeholder icons (can be refined later):
- `public/icon/16.png`
- `public/icon/32.png`
- `public/icon/48.png`
- `public/icon/128.png`

For now, create simple purple squares or use a placeholder generator.

### 9. TypeScript Configuration

**tsconfig.json** (WXT may generate this, adjust as needed)
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `wxt.config.ts` | WXT configuration with manifest |
| `tailwind.config.js` | Tailwind with HN-style colors |
| `src/styles/globals.css` | Global styles |
| `src/entrypoints/background.ts` | Service worker placeholder |
| `src/entrypoints/newtab/*` | New tab page React app |
| `src/entrypoints/options/*` | Options page React app |
| `src/lib/utils/cn.ts` | Tailwind class utility |
| `src/types/index.ts` | Shared TypeScript types |
| `public/icon/*.png` | Extension icons |

---

## Acceptance Criteria

- [ ] `npm run dev` starts WXT dev server without errors
- [ ] Extension loads in Chrome (chrome://extensions with developer mode)
- [ ] Clicking extension icon logs to console
- [ ] Opening new tab shows placeholder UI with purple header
- [ ] Opening options page shows placeholder UI
- [ ] Tailwind classes work (colors, fonts render correctly)
- [ ] No TypeScript errors

---

## Testing

### Manual Testing
1. Run `npm run dev`
2. Load unpacked extension in Chrome
3. Open new tab → see bmbl placeholder
4. Click extension icon → check console for log
5. Right-click icon → Options → see settings placeholder

### Verification Commands
```bash
npm run build      # Should build without errors
npm run typecheck  # Should pass TypeScript checks
```

---

## Notes

- WXT handles hot reload automatically during development
- Icons can be simple placeholders for now (purple squares)
- ShadCN components will be added as needed in later phases
- The manifest permissions are set for V1 requirements

---

## Next Phase

Once this phase is complete, proceed to **Phase 2: Data Layer** to implement IndexedDB schema and DAL.

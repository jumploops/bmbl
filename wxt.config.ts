import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Bookmark Backlog',
    short_name: 'bmbl',
    description: 'Save all tabs with one click. Triage your reading backlog.',
    version: '0.0.1',
    permissions: [
      'tabs',
      'tabGroups',
      'storage',
      'unlimitedStorage',
      'alarms',
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

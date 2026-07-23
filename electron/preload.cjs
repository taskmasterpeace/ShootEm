// The desktop build's only bridge. Deliberately almost empty: the game is the
// same code that runs in a browser, and the less it knows about its shell the
// less there is to keep in sync.
//
// `window.__desktop` lets the client tell a packaged build from a tab — used
// to show controller glyphs by default and to skip the PWA install prompt.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('__desktop', {
  platform: process.platform,          // 'win32' | 'linux'
  version: process.versions.electron,
  // a Steam Deck reports this exact resolution in gaming mode
  isDeck: process.platform === 'linux'
    && (process.env.SteamDeck === '1' || process.env.SteamOS === '1'),
});

// ═══════════════════════════════════════════════════════════════════════════
// WAR WORLD — the desktop shell.
//
// Robert: *"I want to be able to play this on my Steam Deck… it needs to
// launch into the game, no browser, no terminal, no mouse."*
//
// This is a deliberately thin Electron main process. The game is unchanged:
// the same dist/ that the browser build produces is what loads here. Nothing
// in src/ knows this file exists, which is the point — the desktop build must
// never become a second version of the game to keep in sync.
//
// STEAM DECK NOTES (OLED, 1280×800, 16:10, 90Hz):
//   · fullscreen from the first frame — no window chrome, no menu bar, no
//     flash of a browser
//   · the GPU flags below matter on the Deck's RDNA2 under Wayland/gamescope;
//     without them Electron can land on software rendering and you get 12fps
//     with no error message at all
//   · Steam's on-screen keyboard is summoned by the Steam button + X, and it
//     types into whatever DOM input has focus — so the callsign field works
//     without any special handling
// ═══════════════════════════════════════════════════════════════════════════
const { app, BrowserWindow, protocol, net, screen, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// ── THE APP:// PROTOCOL — why this exists ─────────────────────────────────
// The game asks for assets by ABSOLUTE path at runtime: `fetch('/audio/x.ogg')`,
// `/models/memorial.glb`, the music library's `/audio/music/*.mp3`. Under a
// plain file:// load, a leading slash means the FILESYSTEM ROOT — so every one
// of those 404s and you get a black screen with no sound and no error anybody
// would recognise.
//
// Serving the app from a real origin fixes all of them at once, including the
// ones built dynamically at runtime that no find-and-replace would have
// caught. One change in the shell instead of fourteen in the game — and the
// game stays a browser game, which is the whole point.
const DIST = path.join(__dirname, '..', 'dist');
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
}]);

// ── GPU: the difference between 90fps and a slideshow on a Deck ────────────
// ANGLE on GL is the reliable path for Chromium on Mesa/RDNA2. Vulkan is
// faster in theory and flakier in practice under gamescope; if a future Deck
// image fixes that, this is the one line to revisit.
app.commandLine.appendSwitch('use-gl', 'angle');
app.commandLine.appendSwitch('use-angle', 'gl');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
// the Deck runs at 90Hz; do not let Chromium cap the compositor at 60
app.commandLine.appendSwitch('disable-frame-rate-limit');
// a game does not need the background-tab throttle that a browser does
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

/** One instance only — a second launch focuses the first. */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
}

const DEV = !!process.env.WARWORLD_DEV;

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  const win = new BrowserWindow({
    // On a Deck this is 1280×800 and goes straight to fullscreen. On a desktop
    // it opens large but windowed, so a developer is not trapped.
    width: Math.min(1600, width),
    height: Math.min(900, height),
    fullscreen: !DEV,
    autoHideMenuBar: true,
    backgroundColor: '#0d0f0c',      // the game's own black — no white flash
    show: false,                      // …and no empty window before it is ready
    title: 'War World: Earth',
    icon: path.join(__dirname, '..', 'public', 'icons', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      // the game ships its own audio; no gesture gate on a desktop build
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  // no application menu at all — F11/Alt+F4 still work, but there is nothing
  // for a stray controller-driven cursor to open
  win.setMenu(null);

  win.once('ready-to-show', () => {
    win.show();
    if (!DEV) win.setFullScreen(true);
  });

  if (DEV) {
    win.loadURL(process.env.WARWORLD_DEV_URL || 'http://localhost:3400/');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadURL('app://warworld/index.html');
  }

  // F11 toggles fullscreen; Escape must NEVER leave fullscreen, because Escape
  // is the game's own back/pause key and losing the screen mid-match is the
  // most annoying thing a wrapper can do.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); event.preventDefault(); }
    // Alt+Enter, the other fullscreen convention
    if (input.alt && input.key === 'Enter') { win.setFullScreen(!win.isFullScreen()); event.preventDefault(); }
  });

  // anything that tries to open a new window goes to the real browser instead
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // a crashed renderer should say so rather than sitting on a black screen
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[war world] renderer gone:', details.reason);
  });

  return win;
}

app.whenReady().then(() => {
  // map app://warworld/<path> onto dist/<path>, refusing anything that tries
  // to climb out of it
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const target = path.join(DIST, rel);
    if (!target.startsWith(DIST)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(target).toString());
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());

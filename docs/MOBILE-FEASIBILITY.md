# War World — Mobile Feasibility Report

*2026-07-10*

## The short answer

**No install, no app store — it already loads in a phone browser.** War World is a plain web page (Three.js + WebGL), and every modern phone browser (iOS Safari, Android Chrome) runs WebGL well. The menu is already responsive at phone width (see `docs/screenshots/mobile-menu.jpg` — captured at iPhone 14 dimensions, 390×844).

**The one real gap: controls.** The game currently reads keyboard + mouse only. On a phone today you can browse the menu and deploy, but you'd stand at spawn with no way to move. Phones need on-screen touch controls — a solved, well-understood pattern.

## What works on mobile right now

| Piece | Status |
|---|---|
| Loading the game in Safari/Chrome | ✅ Works — it's just a URL |
| Menu / match setup UI | ✅ Already reflows cleanly at 390px |
| WebGL rendering (Three.js) | ✅ Low-poly scene, instanced walls, capped pixel ratio — phone GPUs handle far more |
| Sound (WebAudio) | ✅ Works — starts on the Deploy tap (satisfies mobile autoplay rules) |
| Multiplayer over LAN | ✅ Same `ws://` URL works from a phone on the same Wi-Fi |
| Playing (move/aim/shoot) | ❌ Needs touch controls |

## The path to "fully playable on a phone"

1. **Virtual twin-stick controls** *(the real work — roughly a day)*
   Left thumb: floating joystick → `moveX/moveZ`. Right thumb: drag to aim, hold to fire → `aimYaw/fire`. Tap-buttons for E / Q / G / R along the right edge. This plugs directly into the existing `PlayerCmd` struct — the sim doesn't change at all; it's one new input source (`touch.ts` next to `input.ts`).
2. **Auto-quality on mobile** *(an hour)* — detect touch devices: drop shadows, cap `devicePixelRatio` at 1.5, halve particle budget. The sim is untouched.
3. **PWA manifest + service worker** *(an hour)* — "Add to Home Screen" gives a full-screen icon-launched app with offline asset caching. Still zero app-store involvement.
4. **Only if you ever want the stores**: wrap the same build in Capacitor for iOS/Android binaries. Not needed for personal/LAN play.

## Playing away from home

The dedicated server is a WebSocket on port 3401. For play outside the LAN, expose it through the **cloudflared tunnel already running on this Mac** (`wss://` through a tunnel hostname) — no port forwarding, and the Vite build can be served as static files by anything (even `npx serve dist`).

## Recommendation

Do steps 1–3 (touch controls, mobile quality tier, PWA). That makes War World a phone game you launch from a home-screen icon and play on the couch against the Mac Mini's server — with zero app-store friction. Skip native wrapping unless distribution to strangers ever matters.

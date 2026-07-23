# WAR WORLD ON THE STEAM DECK

> *"I want to be able to play this on my Steam Deck… I need to be able to
> navigate through all of the stuff. I feel like we created a lot of stuff that
> we might not be able to get to."*

You were right about the hard part. Packaging a Three.js game is an afternoon;
**making every screen reachable without a mouse** is the actual work, and that
is what most of this build is.

Your unit is the **Steam Deck OLED** (1280×800, 16:10, 90 Hz — the original was
the LCD). Everything below is tuned for it.

---

## DOWNLOAD IT

**https://github.com/taskmasterpeace/ShootEm/releases/tag/v0.1.0-deck**

One file, 117 MB, portable. Grab it from the phone, the Deck, anywhere.

## TL;DR — the fastest way to play it today

1. On your PC: `npm run dist:win`
2. Copy `release/WarWorldEarth-1.0.0-win-x64.exe` to the Deck
3. Desktop Mode → Steam → **Add a Non-Steam Game** → pick the .exe
4. Right-click it in your library → **Properties → Compatibility → Force
   Proton Experimental**
5. Back to Gaming Mode. Launch. Play.

That works because Proton runs Electron apps well. **Path B below is the better
long-term answer** (a native Linux build, no Proton layer), but Path A gets you
playing tonight.

---

## WHAT YOU GET

| | |
|---|---|
| **Windows** | `.exe` — a one-file portable, plus an NSIS installer |
| **Linux / Deck** | `.AppImage` — one file, no install, no root, survives SteamOS updates |
| **Launch** | straight into the game, fullscreen, no browser, no terminal |
| **Input** | fully playable on a controller — menus included |
| **Server** | none. It is all local. |

The game itself is **completely unchanged** — the desktop shell loads the same
`dist/` the browser build produces. There is no second version to keep in sync.

---

## BUILDING

```bash
npm run dist:win      # Windows .exe (portable + installer)
npm run dist:linux    # Linux .AppImage
npm run desktop       # build and run it locally, right now
```

**One honest caveat:** `dist:linux` produces an AppImage and **AppImage cannot
be built on Windows** — the tooling is Linux-only. Three ways round it:

- **WSL2** (easiest on your machine): open Ubuntu, `cd /mnt/d/git/ShootEM`,
  `npm ci`, `npm run dist:linux`.
- **Build on the Deck itself** — Desktop Mode has everything; clone and run.
- **Skip it** — Path A above (the .exe under Proton) genuinely works.

---

## GETTING IT ONTO THE DECK

### Path A — the Windows exe under Proton *(works today)*

1. Copy the `.exe` anywhere on the Deck (`~/Games/WarWorld/` is tidy).
2. **Desktop Mode** → Steam → bottom-left **Add a Game** → **Add a Non-Steam
   Game** → **Browse** → select the `.exe`.
3. In your library, right-click **War World Earth** → **Properties**:
   - **Compatibility** → tick *Force the use of a specific Steam Play tool* →
     **Proton Experimental** (or Proton 9+)
   - **Shortcut** → set the icon if you want it looking right in Gaming Mode
4. Return to **Gaming Mode**. It appears under **Non-Steam**.

### Path B — the native AppImage *(better)*

1. Build it (see the WSL note above) → `release/WarWorldEarth-…-x86_64.AppImage`
2. Copy it to the Deck, then make it executable — in Dolphin: right-click →
   Properties → Permissions → **Is executable**. Or in Konsole:
   ```bash
   chmod +x ~/Games/WarWorld/WarWorldEarth-1.0.0-linux-x86_64.AppImage
   ```
3. Add as a Non-Steam Game exactly as above.
4. **Leave compatibility OFF.** It is a native Linux binary; forcing Proton
   would make it slower and stranger.

> **Why AppImage and not Flatpak:** SteamOS wipes `/usr` on every system
> update. An AppImage in your home folder survives; anything installed the
> normal way does not.

---

## THE CONTROLS

### In a match

| Control | Does |
|---|---|
| Left stick | move — analogue, so a gentle push crawls; push it all the way to sprint |
| Right stick | aim |
| **RT** / **LT** | fire / alt-fire |
| **A** | jump · **B** reload · **X** use / enter vehicle · **Y** ability |
| **RB** *(hold)* | aim a grenade — release to throw |
| **LB** | cycle weapon · **D-pad ◄►** weapon slots · **D-pad ▲▼** zoom |
| **L3** | send the dog · **R3** dog stay/heel |
| **Back** *(hold)* | scoreboard |

### Everywhere else — the part that was missing

| Control | Does |
|---|---|
| Left stick / D-pad | move the focus — **spatially**, so up goes to what is actually above |
| **A** | select |
| **B** | back / close |
| **LB** / **RB** | previous / next app — walks the GONET's tabs |
| **LT** / **RT** | scroll |
| **☰ (Start)** | the screen's primary action — usually DEPLOY |

**IN A MATCH, ☰ (Start) PAUSES** — and the pause screen is pad-navigable, so
RESUME and **ABANDON MATCH** are both reachable with the stick and A. Without
that you would be stuck in a match forever with no keyboard to escape with,
which is exactly what the first controller run found.

A hint bar sits at the bottom of every menu saying exactly this, and it
disappears the moment a match starts.

**Typing (your callsign, naming a playlist):** press **Steam + X** for Steam's
on-screen keyboard. It types into whatever field the pad has focused.

---

## STEAM DECK SETTINGS I'D USE

Press **…** (the three dots) in game:

| Setting | Value | Why |
|---|---|---|
| Framerate Limit | **60** | the sim is fixed-step; 60 is smooth and roughly doubles battery vs 90 |
| Refresh Rate | **60 Hz** | match it to the limit or you get judder |
| Half Rate Shading | Off | it makes text mushy, and this game is full of small text |
| TDP Limit | **9–10 W** | plenty for this; big battery win |
| Scaling Filter | **Linear** | it renders at native 1280×800 — nothing to upscale |

In the game's own **OPTIONS**, if you want more headroom: set **Quality** to
`low`, which caps the pixel ratio and drops MSAA.

---

## WHAT I CHANGED TO MAKE THIS WORK

Worth knowing, because two of these were real bugs rather than polish:

1. **A universal controller navigator** (`src/client/gamepad-ui.ts`) — spatial
   DOM focus for every screen that exists and every screen we add later. It
   stands down completely in a match so it never fights the soldier controls.
2. **A visible focus ring.** Nothing showed focus before, which on a pad means
   you are lost. It is an outline plus a glow so it never shifts layout, and it
   inverts to white on amber controls where amber-on-amber would vanish.
3. **THE BUG: the pad could reach through the laptop.** Spatial navigation
   cannot tell that an element is *covered*, so it happily focused the deploy
   screen's button sitting behind the full-screen GONET — and started a match
   with the laptop still over the top of it. Focus is now scoped to the topmost
   visible layer.
4. **THE OTHER BUG: `app://` instead of `file://`.** The game fetches assets by
   absolute path at runtime (`/audio/x.ogg`, the music library, the models).
   Under `file://` a leading slash means the *filesystem root*, so every one of
   them 404s — a black screen and silence, with no error a human would
   recognise. The shell now serves `dist/` from a real origin, which fixes all
   of them at once, including the ones built dynamically that no
   find-and-replace would have caught.
5. **Deck-sized type.** A 0.5rem label is fine on a 27" monitor and unreadable
   on a 7" screen in your hands. Everything scales up under `body.deck`.
6. **16:10.** THE BOARD's cinemascope band was tuned for 16:9; on a 1280×800
   screen it now takes a shorter slice so it doesn't eat the game.

---

## IF SOMETHING GOES WRONG

**Black screen, no sound.** Almost always an asset-path problem. Run it from a
terminal on the Deck to see the errors:
```bash
./WarWorldEarth-1.0.0-linux-x86_64.AppImage --enable-logging
```

**It won't launch at all under Proton.** Try Proton 9 instead of Experimental.
Failing that, use the native AppImage.

**Terrible framerate.** Check it isn't on software rendering:
```bash
./WarWorldEarth-*.AppImage --enable-logging 2>&1 | grep -i swiftshader
```
Any hit there means the GPU flags didn't take. The AppImage already passes
`--no-sandbox`, which is what usually causes it inside a Flatpak Steam.

**The controller does nothing in menus.** Check Steam's controller layout for
the shortcut is **Gamepad**, not *Desktop* or *Mouse only* — Desktop layout
sends keyboard events and the game never sees a pad.

**Stuck fullscreen.** `F11` or `Alt+Enter`. Escape deliberately does *not* exit
fullscreen, because Escape is the game's own back/pause key.

---

## STILL TO DO

- Steam Input glyphs (showing ⓐ/Ⓑ per the player's actual pad) — currently
  generic letters
- Cloud saves — everything is in `localStorage` today, so a Deck save and a PC
  save are separate
- A proper `.ico` for Windows (the build converts a PNG, which is fine but not
  crisp at every size)

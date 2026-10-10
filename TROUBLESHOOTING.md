# IBADAN LIFE — "Can't enter after pressing ENTER" Troubleshooting Guide

**Game:** IBADAN LIFE (browser 3D life sim — Three.js/WebGL)
**Symptom:** Pressing the **ENTER IBADAN** button (or the keyboard **Enter** key) doesn't open the game.

---

## 0. What *should* happen when you press ENTER IBADAN

The entry is a **two-step** flow, so it's normal to see a second screen before the game world:

1. **Loading screen** → press **ENTER IBADAN** (or keyboard **Enter**).
2. **New player:** the **"Create Your Character"** screen appears → type a name → press **START LIFE** (or **Enter**).
   **Returning player:** the game world opens immediately.
3. The **HUD** appears (₦ cash, name, level, needs bars) and you can move with the joystick / WASD.

> If you saw the **"Create Your Character"** screen, the button *did* work — you just need to press **START LIFE** to finish entering. This is the most common false alarm.

---

## 1. Confirm you're on the fixed build (most important)

At the **bottom of the loading screen** there is now a small grey badge:

```
Build v1.1.0 · WebGL ✓
```

- **If you see `v1.1.0`** → you have the fix. Go to step 3.
- **If you see `v1.0.x`, nothing, or a different build** → your browser is serving a **cached old version**. Do a hard refresh:
  - **Desktop:** `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac).
  - **Android Chrome:** ⋮ menu → History → Clear browsing data → Cached images and files.
  - **iOS Safari:** Settings → Safari → Clear History and Website Data (or use Private tab).
  - Or open the link in a **Private/Incognito** window.

---

## 2. Check the WebGL status in the badge

The badge also reports GPU support:

| Badge shows | Meaning | Action |
|---|---|---|
| `WebGL ✓` | 3D is supported | Continue to step 3 |
| `WebGL1 only ✗` | Your browser only has WebGL1 | Update the browser / enable hardware acceleration |
| `WebGL ✗` | 3D is disabled or unsupported | Enable hardware acceleration, update GPU drivers, or try another browser |

**Enable hardware acceleration:** Chrome/Edge → Settings → System → "Use hardware acceleration when available" → ON → relaunch. On mobile, update the OS/browser.

---

## 3. Try both input methods

- **Keyboard:** press **Enter** on the loading screen.
- **Button:** tap/click **ENTER IBADAN**.

Both now run the exact same code path. If the button works but Enter doesn't (or vice-versa), tell us — it's a new data point.

---

## 4. If the button does nothing at all

1. **Wait for loading to finish.** The button only becomes active once the world is built. If you press too early you'll now see *"Still loading… please wait a moment."* — just wait and press again.
2. **Look for a red error line** under the progress bar (e.g. *"Failed to start: … · WebGL ✗"*). If present, the badge's WebGL status tells you why.
3. **If the button says "Retry"**, the engine failed to boot — tap **Retry** after enabling hardware acceleration.
4. **Open the browser console** (`F12` → Console on desktop) and copy any red errors.

---

## 5. If the game opens but the screen looks black/empty

The world now starts in **mid-morning** and is brightly lit. If it still looks black:

- Wait 2–3 seconds for the first frame (mobile GPUs can be slow on first load).
- Make sure you completed **START LIFE** (character creation).
- Check the badge says `WebGL ✓`.

---

## 6. Reset a corrupted save (rare)

If you previously saved and the game now misbehaves on load, clear the save:

- **Console (desktop):** `F12` → Console → run `localStorage.clear()` → reload.
- **Mobile:** clear site data for the page, or use a Private tab.

> Note: the fixed build now **auto-repairs** malformed saves instead of failing, so this should no longer be necessary.

---

## 7. Try the alternate URL

Two ways to play:

- **Static build:** `https://sites.super.myninja.ai/e00160f0-d671-4a51-aa6a-6892cd9e7253/8dde6ea8/index.html`
- **Live multiplayer (real players):** `https://vision-basket-wisconsin-attractions.trycloudflare.com`

If one fails and the other works, tell us which — it isolates the cause (hosting vs. device).

---

## 8. Still stuck? Send us these details

1. **URL** you opened (static vs. multiplayer).
2. **Device + browser** (e.g. "Android 14, Chrome 120" / "iPhone 13, Safari" / "Windows 11, Edge").
3. **What the badge says** (e.g. `Build v1.1.0 · WebGL ✓`).
4. **Exactly what happens** when you press ENTER IBADAN: nothing / character screen / black screen / error text.
5. Any **console errors** (F12 → Console).

---

### What was actually wrong (technical summary)

- The **keyboard Enter key had no handler at all** — it was never wired to entry. (Fixed.)
- The **button** could fail **silently**: it returned immediately if the engine wasn't ready, and it called the audio system before loading the profile with no guard, so a device-specific audio failure could abort entry. (Fixed — audio is now best-effort and entry always gives visible feedback.)
- A **malformed save** (e.g. `position: null`) could break loading. (Fixed — saves are now repaired.)
- The world started at **dawn and looked almost black**, which could be mistaken for "nothing opened." (Fixed — starts mid-morning, brighter lighting.)

Verified with an automated browser test (`server/repro-enter.mjs`): **6/6 scenarios pass, 0 console errors**, covering keyboard Enter (fresh + returning), button click (fresh + returning), the full keyboard-only flow, and a corrupted save.

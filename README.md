# Eldin Mobile UI v1.3.0

## Fixes in this release

### Top panels: robust full-screen mobile stage
The top icon tray remains compact, but tapping any SillyTavern top icon now
captures the real native drawer-content reference before SillyTavern animates
or reparents it. After SillyTavern runs its own initialization, the exact live
panel is moved into the dedicated mobile stage.

This fixes the "2 px line only" problem seen in v1.2.

The stage is explicitly sized with fixed top/left/right/bottom coordinates,
a minimum height, flex layout, and a scrollable body.

### Message avatar behavior restored
- Tap a character NAME -> open that character's controls/card.
- Tap the round character AVATAR -> SillyTavern's normal enlarged image behavior.

### Header auto-hide strengthened for iPhone Safari
The header now reacts to:
- accumulated #chat scroll movement
- actual iOS touch/finger direction as a fallback

Scroll forward/down through the conversation -> header hides.
Reverse direction -> header returns.

### Smart Guided Swipe
The existing Guided Swipe button now behaves as:

1. If a saved swipe exists ahead:
   - move to that saved swipe
   - DO NOT generate a new output
   - DO NOT consume/alter typed guidance

2. If already on the final saved swipe:
   - let Guided Generations' original handler run
   - typed text in the composer is injected normally
   - a genuinely new guided swipe is generated

This means you can move:
1 -> 2 -> 3 -> 2 -> 3
without losing swipe 3, and only generate swipe 4 when you advance past the
last existing swipe.

The Previous Swipe button uses SillyTavern's real context.swipe.left() when
available.

### Emergency Safari safe mode
Starting with v1.3, if this extension ever breaks the UI again, reload
SillyTavern with:

    ?eldinui=off

Example:

    http://YOUR-SILLYTAVERN-ADDRESS:8000/?eldinui=off

If your URL already has a query string, append:

    &eldinui=off

The extension's JavaScript will skip initialization, and because the theme CSS
is scoped behind the class that JavaScript adds, SillyTavern returns to its
normal UI for that page load.

You can then open Manage Extensions and disable/update Eldin Mobile UI without
touching the laptop files.

IMPORTANT: this rescue switch starts with v1.3; it cannot retroactively disable
v1.2.

## GitHub update

Keep the repository if you want future updates from GitHub.

Replace:
- manifest.json
- index.js
- style.css
- README.md

Commit the changes, then use SillyTavern -> Manage Extensions -> Update.

## Mobile only
The redesign is scoped to screens up to 1000px wide.

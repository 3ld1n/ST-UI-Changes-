# Eldin Mobile UI v1.4.0

## Changes

- Removed the `?eldinui=off` emergency URL feature entirely.
- Removed the auto-hide-on-scroll header feature. The compact header now stays
  stable at all times.
- Full settings panels now stretch from below the header to the bottom of the
  iPhone viewport instead of shrinking to content height.
- Settings panels are now opaque dark panels so the chat behind them does not
  distract from API / World Info / Extensions / Character settings.
- The compact top icon tray stays open while a settings panel is open, making
  it easy to jump between sections.
- The custom header and icon tray remain above the settings overlay.
- Forces the browser/theme/status-bar color back to `#101012`, including after
  switching chat files, to prevent the bright blue iOS top area.
- During generation, Send is hidden whenever Stop is visible. When generation
  ends, Stop disappears and Send returns.
- Existing smart Guided Swipe, Previous Swipe, Quick Persona, long-press
  message actions, character-name controls, avatar enlargement, and the Wand
  tray are preserved.

## GitHub update

Replace these four files in the existing repository:

- manifest.json
- index.js
- style.css
- README.md

Commit, then use SillyTavern -> Extensions -> Manage Extensions -> Update and
reload the page.

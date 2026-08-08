# Eldin Mobile UI v1.1.0

A mobile-only SillyTavern UI extension focused on a clean messenger-style
layout while preserving the real SillyTavern / extension controls.

## v1.1 changes

- Reduced permanent top header height.
- Header control tray is now one compact horizontal row and overlays the header.
- Fixed top drawer panels (API, Group Controls, Extensions, etc.) to open below
  the compact header and use the phone width.
- Character and persona message avatars are now the same size.
- Uses the REAL Quick Persona extension button instead of a cloned avatar:
  tapping it opens Quick Persona, and persona changes update automatically.
- Removed ", or /? for help" from the connected textarea placeholder.
- Uses the REAL native SillyTavern options button inside the wand tray so its
  existing Popper/menu behavior stays intact.
- Removes native quick Impersonate/Continue duplicates from the composer.
- Moves the ENTIRE Guided Generations action container into the wand tray,
  preserving:
    - Guided Generations Tools
    - Persistent Guides + active count
    - Guided Swipe
    - Guided Response
    - Guided Continue
    - any other enabled Guided Generations action buttons
    - integrated Quick Reply buttons
- Hides Guided Generations impersonation buttons on this mobile UI.
- Captures any other extension-added buttons from #leftSendForm and puts them
  inside the wand tray instead of losing them.
- Keeps the standalone message edit pencil hidden while moving its real button
  into the three-dot message actions.
- Keeps swipe arrows/counter hidden.

## Manual update

Replace the contents of your existing:

    SillyTavern/data/<your-user-handle>/extensions/eldin-mobile-ui/

with these files, then reload SillyTavern.

If your existing folder is named differently, keep the same folder name and
replace manifest.json, index.js and style.css.

## Important

Do not keep a second copy of the old Eldin UI CSS in SillyTavern Custom CSS
after confirming this extension works, or duplicate rules may fight each other.

## Git workflow for easy iPhone updates

For easier future updates from Safari, put these extension files in a GitHub
repository and install that repository once using SillyTavern's
Extensions -> Install extension.

After that, you can edit/commit the repo from Safari and use SillyTavern's
Manage Extensions -> Update instead of manually copying files each time.

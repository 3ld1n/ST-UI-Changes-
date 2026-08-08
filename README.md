# Eldin Mobile UI v1.2.0

Mobile-focused SillyTavern UI extension.

## New in v1.2

### Full-size mobile settings panels
Top-bar icons still live in the compact one-row tray, but their real native
SillyTavern drawer content is now temporarily moved into a dedicated mobile
panel stage. This prevents API, Extensions, World Info, Persona, Character /
Group controls, etc. from being squeezed into the tiny icon container.

The opened panel:
- uses almost the full phone width and height
- keeps the real native SillyTavern controls and listeners
- can be closed with its own X or by tapping the dimmed background
- is returned to its original SillyTavern drawer when closed

### Tap header for current chat details
Tap the header avatar or title:
- group chat -> opens the current group's controls
- single character chat -> opens the current character editor

### Tap a character in the chat
Tap an AI character's name or avatar:
- single chat -> opens that character
- group chat -> opens that specific group member's character definition

This intentionally replaces SillyTavern's default avatar-zoom tap on AI
message avatars for this mobile theme.

### Auto-hide header while reading
Scrolling down hides the header to give the chat more vertical room.
Scrolling upward brings it back.

The header stays visible while menus or full-size settings panels are open.

### Long-press message actions
The visible (...) button is removed.
Long-press a message bubble to open the same native Message Actions menu.

The real Edit action is still moved inside Message Actions.

### Previous swipe button
A new Back/Previous Swipe button is inserted immediately beside Guided Swipe
when Guided Generations is present.

It uses SillyTavern's real hidden .swipe_left button, so it returns to an
earlier generated swipe instead of generating a new one.

The button disables itself when there is no earlier swipe.

### Composer polish
- Keeps the real Quick Persona button
- Keeps the Wand tray
- Keeps Guided Generations buttons live
- Keeps the native SillyTavern Options button live
- Input text/placeholder is explicitly left-aligned inside the actual text area
  instead of visually floating in the center
- Native Quick Impersonate / Continue duplicates stay hidden

## Updating manually

Replace the files in:

    SillyTavern/data/<your-user-handle>/extensions/eldin-mobile-ui/

with:
- manifest.json
- index.js
- style.css
- README.md

Then reload SillyTavern.

## GitHub workflow

Keep the GitHub repository if you want SillyTavern to keep updating this
extension from GitHub.

After an extension is installed, SillyTavern has a local copy, so deleting the
GitHub repository would not instantly remove the installed extension.
However, future Update checks would lose their source.

For easy iPhone updates:
1. Keep the extension repository.
2. Replace index.js, style.css, manifest.json and README.md in GitHub.
3. Commit the changes.
4. Open SillyTavern -> Extensions -> Manage Extensions -> Update.
5. Reload the page.

## Notes

- Mobile-only at widths up to 1000px.
- No character cards, chats, prompts, API keys, or user data are stored in this
  extension.

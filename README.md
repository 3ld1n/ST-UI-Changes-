# Eldin Mobile UI v1.6.3

Rollback / stabilization release.

## Important: PWA layout hacks removed

v1.6.3 is built from the original v1.6.0 layout code.

All experimental PWA/safe-area/viewport geometry changes from v1.6.1 and
v1.6.2 are intentionally removed.

This means Eldin Mobile UI once again leaves SillyTavern's native page/PWA
geometry alone.

## Preserved fixes

### Long-press Message Actions
The improved long-press behavior is retained:
- no accidental text selection while holding a message
- iOS text callout suppressed during the gesture
- scrolling still cancels the hold normally

### Scroll to latest
The working down-arrow implementation is retained:
- a 1px sentinel is kept at the physical end of #chat
- IntersectionObserver detects when the end leaves the visible chat area
- the down arrow appears when reading older messages
- tapping it returns to the real end of the chat
- it disappears again at the bottom

## Everything else

All stable v1.6.0 features remain unchanged:
- messenger-style layout
- compact header and top controls
- settings panels
- Quick Persona
- Guided Generations
- smart swipe navigation
- Guided Response
- group avatar collage / roster
- Wand ordering

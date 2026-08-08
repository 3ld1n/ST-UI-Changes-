# Eldin Mobile UI v1.5.0

Focused Guided Response hotfix. Version remains 1.5.0 as requested.

## Guided Response fix

- The Guided Response button now calls Guided Generations' own live
  `window.GuidedGenerations.guidedResponse()` function.
- The Eldin Wand tray is deliberately kept open while Guided Generations opens
  its group-member picker. GG positions that picker relative to its action
  toolbar, so closing/hiding the tray too early could make the picker appear
  offscreen.
- GG's fallback group-member picker is forced to a stable, high-z-index mobile
  position above the composer.
- No other working Eldin Mobile UI features were intentionally changed.

## Icon fix

Guided Generations attaches `fa-dog` directly to the button element itself.
The previous patch looked for a child icon, so the dog remained visible.

This hotfix replaces the button's own `fa-dog` class with
`fa-comment-dots`, giving Guided Response a neutral chat/reply icon.

## GitHub

Keep the manifest at version 1.5.0. Replace the repository files, commit, then
use Manage Extensions -> Update and reload.

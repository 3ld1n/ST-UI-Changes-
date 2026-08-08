# Eldin Mobile UI v1.5.0 — hotfix 5

Version remains **1.5.0**.

## Guided Response picker
Rebuilt the group-character selector using the browser's native
`<dialog>` top layer.

This avoids iPhone Safari's fixed-position viewport issue that was
pushing the top of the selector off-screen.

The selector should now:
- stay fully visible in the center of the screen
- show all group members with avatars
- scroll internally if the group is large
- close by tapping X, the backdrop, or choosing a character

## Wand tray
The Wand tray stays open while you are choosing a character.
As soon as you choose the responder and Guided Response begins,
the Wand tray closes automatically.

Single-character Guided Response also closes the Wand tray as soon as
generation starts.

No other working Eldin Mobile UI features were intentionally changed.

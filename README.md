# Eldin Mobile UI v1.5.0 — hotfix 3

Version remains **1.5.0**.

## Guided Response fix
The Guided Response button now replaces the original Guided Generations
button node with a cloned one. This removes the old click handler that
could still open an off-screen popup.

Group chats now rely on Eldin Mobile UI's own mobile character picker,
and only after selection does it hand control to Guided Generations for
the real response generation.

## Extra UI fix
The custom Guided Response picker is now forced to appear as a centered
modal inside the visible mobile viewport.

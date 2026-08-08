# Eldin Mobile UI v1.5.0 — hotfix 4

Version remains **1.5.0**.

## Guided Response picker placement
The group-character picker is no longer centered using iPhone Safari's
layout viewport. It is now anchored above the actual Eldin Wand tray,
which keeps the entire selector visible and avoids the top of the
picker being pushed off-screen.

## Wand behavior
- While choosing a group member, the Wand tray stays open.
- As soon as you tap the character and Guided Response starts,
  the Wand tray closes automatically.
- In single-character chats, it closes immediately when generation
  starts.

No other working UI behavior was intentionally changed.

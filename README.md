# Eldin Mobile UI v1.6.0

Built on the stable v1.5 Guided Response hotfix.

## Wand tray order

The first two existing controls stay where they were:
- native chat hamburger
- existing extra/wand control

Guided Generations is visually reordered to:
1. Previous swipe
2. Guided Swipe / next saved swipe
3. Guided Response
4. Guided Continue
5. Guided Generations tools / save bookmark
6. Persistent Guides book + active count

The real buttons are not cloned or recreated; CSS changes their visual order
while their original behavior remains intact.

## Scroll to latest

When you scroll far enough above the newest message, a small down-arrow appears
at the bottom-right above the composer.

- tap it to smoothly return to the latest message
- it disappears automatically when you're near the bottom
- it hides while the Wand, top menus, settings panels, dialogs, or keyboard
  input are active

## Group header collage

Group chats now use the same tiny circular header area without increasing the
header height.

- 1 present character: single portrait
- 2: split portrait
- 3: one larger left portrait + two stacked right portraits
- 4: 2x2 grid
- 5+: first three portraits + a +N tile

Muted / disabled group members are treated as not currently present. If every
member is disabled, the extension falls back to showing the full group rather
than an empty avatar.

## Group roster gallery

Tap the group collage in the header to open a native mobile dialog showing all
currently present group characters as large rectangular portrait cards.

- high-resolution character avatar is requested first
- thumbnail is used as fallback
- character names are shown on the cards
- X or backdrop closes the gallery
- long groups scroll inside the gallery

Tap the group title/subtitle as before to open Group Controls.

No changes were made to the stable Guided Response implementation, swipe logic,
top settings panels, Quick Persona, or message layout.

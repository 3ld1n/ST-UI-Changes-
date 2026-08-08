# Eldin Mobile UI v1.5.0

A deliberately small maintenance release.

## Fixed

### Guided Response
The Guided Generations "Guided Response" button is now explicitly bridged to
Guided Generations' own live `window.GuidedGenerations.guidedResponse()`
function.

This keeps the real Guided Generations behavior:
- your typed instruction in the message box
- Guided Response prompt/settings/depth
- group-member selection
- native generation handling

The patch uses the real GG function rather than recreating Guided Response.

### New icon
The old dog icon has been replaced visually with a speech bubble containing
dots, which better represents "guide this character's next response."

No other Eldin Mobile UI behavior was intentionally changed in v1.5.

# Eldin Mobile UI v1.6.1

Bug-fix release built directly from the exact v1.6.0 files currently on the
ST-UI-Changes- GitHub repository.

## iPhone Home Screen / PWA layout

The extension previously forced iOS `black-translucent` status-bar mode.
v1.6.1 uses opaque `black`, keeping the dark status bar while laying the web
content below it.

After updating, fully close the Home Screen PWA from the iOS app switcher and
launch it again so iOS rebuilds the standalone viewport.

## Scroll-to-latest arrow

- no longer stays hidden because the textarea still owns focus
- measures both scroll metrics and the physical position of the last message
- appears sooner after scrolling upward
- uses the last message as an iOS fallback scroll target
- receives a slightly higher z-index

## Long-press Message Actions

While holding a message bubble:
- text selection is temporarily disabled
- the iOS touch callout is disabled
- accidental selection is cleared when Message Actions opens
- the protection stays active until finger release
- moving to scroll still cancels the long press

All working v1.6 features remain unchanged.

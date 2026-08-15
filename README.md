# Eldin Mobile UI v1.6.2

Focused iPhone Home Screen PWA bug-fix release.

## PWA layout fix

This version directly overrides SillyTavern's native iOS/PWA shell geometry.

In standalone/PWA mode:

- the compact Eldin header is positioned below `safe-area-inset-top`
- `#sheld` uses fixed top + bottom edges instead of iOS viewport-height formulas
- SillyTavern's extra PWA bottom padding on `#sheld` is removed
- the composer owns exactly one bottom safe-area inset
- `#chat` flexes to fill every remaining pixel instead of retaining a viewport
  max-height

This targets both symptoms together:
- header/status bar overlap at the top
- large unused black area below the composer

## Scroll-to-latest arrow

The down-arrow now uses a real 1px sentinel at the physical end of the chat.

An IntersectionObserver watches that sentinel relative to `#chat`:
- if the end of the chat leaves the visible area, the arrow appears
- when the end becomes visible again, it disappears
- tapping the arrow scrolls directly to the sentinel
- scroll metrics and visual-viewport geometry remain as fallbacks

This is intentionally more reliable than depending only on iOS `scrollTop`.

## Long press

The v1.6.1 long-press fix is preserved:
- no accidental text selection while holding a message
- iOS callout suppressed during the hold
- normal scrolling still cancels the long-press gesture

All other working v1.6 features are unchanged.

# Eldin Mobile UI v1.6.4

Small polish/fix release built directly from v1.6.3.

## Scroll-to-latest arrow

v1.6.3 accidentally inherited an older CSS rule that hid the floating down
arrow whenever the SillyTavern textarea still had focus.

On iPhone/PWA the textarea can keep focus even with the keyboard closed, so the
arrow could remain invisible forever.

v1.6.4 removes that focus-based hiding rule. The working v1.6.3 sentinel /
IntersectionObserver logic is unchanged.

## Composer bottom spacing

The bottom composer now has a little more breathing room:

- previous minimum bottom padding: 7px
- new minimum bottom padding: 14px

This keeps Quick Persona, text input, Wand, and Send slightly above the bottom
edge without making the composer noticeably taller.

The floating down arrow is also positioned a few pixels higher so it sits above
the raised composer.

## PWA layout

No PWA shell / viewport / safe-area geometry hacks are included.
The native SillyTavern layout remains untouched.

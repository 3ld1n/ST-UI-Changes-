# Eldin Mobile UI v1.6.5

Focused scroll-to-latest reliability fix built directly from v1.6.4.

## Why the arrow could still stay hidden

The previous implementation still assumed that `#chat` itself had to be
scrollable before the arrow was allowed to appear.

In the current SillyTavern iPhone/PWA layout, the actual scroll owner can be
`#chat`, a parent container, or the document. That made the old
`#chat.scrollHeight > #chat.clientHeight` gate capable of staying false even
while the user was visibly scrolling through old messages.

## What v1.6.5 does

- dynamically finds the real scroll container
- no longer requires `#chat` itself to own scrolling
- measures the last message against the visible area above the composer
- keeps the end-of-chat sentinel + IntersectionObserver
- listens to scroll/touch movement globally as well as on `#chat`
- performs several short post-load checks while iOS layout settles
- scrolls the actual scroll owner first, then the literal chat-end sentinel
- raises the button z-index so it cannot sit behind the chat/composer
- preserves the v1.6.4 composer bottom padding
- preserves the long-press text-selection fix
- does not reintroduce any PWA viewport/shell hacks

This release changes only the scroll-to-latest system.

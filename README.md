# Eldin Mobile UI v1.5.0 — Guided Response hotfix 2

Version remains 1.5.0 as requested.

## What changed

The Guided Response button now uses a reliable two-step group flow:

1. Eldin Mobile UI opens its own small mobile character selector for group
   chats.
2. After you choose the member, the extension hands that exact selection back
   to Guided Generations through the group-picker API GG already supports.
3. Guided Generations still performs the real Guided Response itself:
   - reads your typed guidance
   - uses its configured Guided Response prompt
   - applies its configured depth/role
   - injects the instruction
   - targets the selected member
   - runs the real generation
   - restores the input afterward

Single-character chats call Guided Generations directly and do not show the
group picker.

The Guided Response icon remains the speech-bubble-with-dots icon.

No other working Eldin Mobile UI features were intentionally changed.

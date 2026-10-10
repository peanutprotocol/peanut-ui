# Sign-up hero loops

One Lottie file per sign-up screen, played by `src/components/Setup/components/OnboardingAnimation.tsx`. To change a screen's loop, replace its file here. No code changes.

| File | Screen | Source in mono `inbox/signup-polish/animations/out/` |
| --- | --- | --- |
| `invite.json` | Invited by a friend? | `invite-liked-r5.json` |
| `residence.json` | Residence | `residence-r21.json` |
| `add-money.json` | Payment plan | `add-money-wallet-r28.json` |
| `accounts.json` | Accounts | `accounts-r16.json` |
| `card.json` | Peanut Card | `card-r16.json` |
| `email.json` | Email | `email-r13.json` |
| `notifications.json` | Notifications | `notifications-r10.json` |
| `finish.json` | Only for you | `finish-r10.json` |

The picks are the entries marked `"pick": true` in that folder's `final.json`. Welcome shows the waving mascot and the clouds, and the username screen shows the thinking mascot over `username-at.json`. Neither has a loop file.

How a loop plays, from its markers (`loopPlayback.utils.ts`):

- `intro` plays once, `idle` repeats for 2.5 s, then `outro` plays (or the intro restarts), and the cycle repeats.
- A comp with `pp.idle_once: true` plays its `idle` once and goes straight into the `outro`, with no 2.5 s hold.
- A loop with only an `idle` marker cycles that segment. A loop with no `idle` marker loops end to end.
- Under `prefers-reduced-motion` the loop shows the first frame of `idle`.
- The comp is not clipped to its box: the loop may draw across the whole hero, and the hero's edge clips it.

`username-at.json` is the floating "@" background on the username screen. Regenerate it from the UI root with `python3 scripts/build-username-background.py`. Its signs are opaque: at 70% the pink fill read as mauve on the hero blue.

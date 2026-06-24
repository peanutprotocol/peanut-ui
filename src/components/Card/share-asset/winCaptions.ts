/**
 * Caption pool for the "I got in" win share asset.
 *
 * When a user shares their Peanut card win, the share fires with a RANDOM
 * caption from this pool so the timeline doesn't fill with one identical
 * tweet. Mix of pure hype, invite/FOMO, a Devconnect callback, the brand
 * "shhhh" motif, and cheeky anti-bank lines — picked by Hugo from the copy
 * picker. The asset image carries the visual brand, so these are caption-only.
 */

export const WIN_CAPTIONS: readonly string[] = [
    'yay! i got in 🎉',
    "shhhh, i'm in.",
    'i got in. holy shhh.',
    'i got in, will you?',
    "i'm in. you?",
    "remember peanut from devconnect? they're back.",
    "met peanut at devconnect. now i've got the card.",
    'devconnect was just the start — peanut card is here.',
    'from a devconnect booth to my wallet. peanut card 🥜',
    'you saw peanut at devconnect. now watch this.',
    "can't talk — got the peanut card 🤫",
    "shhhh. you didn't see this.",
    "the nuttiest card in crypto, and it's mine.",
    'banked by a peanut. unbothered.',
    "who needs a bank? i've got peanut.",
    "broke up with my bank. it's a peanut now.",
]

/** Pick a random caption. Browser-only (Math.random) — fine at share time. */
export function pickWinCaption(): string {
    return WIN_CAPTIONS[Math.floor(Math.random() * WIN_CAPTIONS.length)]
}

/**
 * Caption pool for the "I got in" win share asset.
 *
 * When a user shares their Peanut card win, the share fires with a RANDOM
 * caption from this pool so the timeline doesn't fill with one identical
 * tweet. Mix of pure hype, invite/FOMO, a Devconnect callback, the brand
 * "shhhh" motif, and cheeky anti-bank lines — picked by Hugo from the copy
 * picker. Every caption tags @joinpeanut so the win post credits the brand
 * (the handle rides the caption — the asset image stays clean).
 */

export const WIN_CAPTIONS: readonly string[] = [
    'yay! i got into @joinpeanut 🎉',
    "shhhh, i'm in @joinpeanut.",
    'i got into @joinpeanut. holy shhh.',
    'i got into @joinpeanut, will you?',
    "i'm in @joinpeanut. you?",
    "remember @joinpeanut from devconnect? they're back.",
    "met @joinpeanut at devconnect. now i've got the card.",
    'devconnect was just the start — the @joinpeanut card is here.',
    'from a devconnect booth to my wallet. @joinpeanut card 🥜',
    'you saw @joinpeanut at devconnect. now watch this.',
    "can't talk — got the @joinpeanut card 🤫",
    "shhhh. you didn't see this. @joinpeanut 🤫",
    "the nuttiest card in crypto, and it's mine. @joinpeanut 🥜",
    'banked by @joinpeanut. unbothered.',
    "who needs a bank? i've got @joinpeanut.",
    "broke up with my bank. it's @joinpeanut now.",
]

/** Pick a random caption. Browser-only (Math.random) — fine at share time. */
export function pickWinCaption(): string {
    return WIN_CAPTIONS[Math.floor(Math.random() * WIN_CAPTIONS.length)]
}

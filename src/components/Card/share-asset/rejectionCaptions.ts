/**
 * Caption pool for the "NOT TONIGHT" rejection share asset.
 *
 * The waitlist rejection screen lets a turned-away user "Tweet to appeal" —
 * the share fires with a RANDOM caption from this pool so the timeline
 * doesn't fill with one identical tweet. Every caption tags @joinpeanut so
 * the rejection itself markets the door's exclusivity.
 *
 * The @joinpeanut handle is also baked into the asset image, so the tag
 * survives even when the PNG is re-posted with no caption.
 */

export const REJECTION_CAPTIONS: readonly string[] = [
    'rejected by @joinpeanut 🚫 the door policy is insane. i WILL be back.',
    "@joinpeanut told me i'm not on the list 💀 the AUDACITY",
    "the @joinpeanut bouncer said come back when i'm somebody. ok bet.",
    'got read for filth by the @joinpeanut door',
    'officially rejected by @joinpeanut. honestly an honor 🥜🚫',
    'collected my first @joinpeanut badge: REJECTED 💀',
    'took an L at the @joinpeanut door. building my comeback arc.',
    "denied at the @joinpeanut door. the bouncer didn't even blink 🚫",
    "@joinpeanut said NOT TONIGHT. guess i'll fix my whole life and come back",
    'turned away from @joinpeanut 💀 most exclusive door in crypto fr',
    "couldn't get past the @joinpeanut velvet rope. humbling.",
    '@joinpeanut rejection #1. framing this one.',
    'the @joinpeanut door looked me up and down and said no. respect.',
    'not on the @joinpeanut list tonight. villain arc starts now.',
    "got bounced from @joinpeanut. it's giving exclusive.",
    '@joinpeanut denied me with zero explanation. iconic behavior honestly',
    '213 tried, 7 got in. @joinpeanut said not me. yet.',
    "@joinpeanut said come back when i'm somebody. challenge accepted 🥜",
    'the @joinpeanut bouncer has no notes. just no. devastating.',
    'tried the @joinpeanut door. NOT TONIGHT. comeback arc loading.',
    "@joinpeanut rejected me and i've never wanted in more 💀",
    'took an L at the @joinpeanut door tonight. tomorrow we ride again.',
]

/** Pick a random caption. Browser-only (Math.random) — fine at share time. */
export function pickRejectionCaption(): string {
    return REJECTION_CAPTIONS[Math.floor(Math.random() * REJECTION_CAPTIONS.length)]
}

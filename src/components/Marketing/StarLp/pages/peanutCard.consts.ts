/** The page's one card spend, named as the card.spend.authorized push names it. */
export const CARD_EXAMPLE_SPEND = {
    amount: '$4.50',
    merchant: 'Corner Coffee',
} as const

/** The lock screen the push lands on. A weekday, not a calendar date, so the
    evergreen page never shows a receipt from a day that has passed. */
export const CARD_LOCK_SCREEN = {
    clock: '10:12',
    date: 'Tuesday',
} as const

/** The receipt fold's copy: the headline alone, no line under it (round 4 pick a7o2,
    21 Oct 2026). "Verification and approval required." stays in the page metadata. */
export const CARD_RECEIPT_FOLD_COPY = {
    title: 'See every spend.',
} as const

/** The pink "who it's for" fold, rewritten from /shhhhh §3 for the core ICP
    (product/icps.md: freelancers, remote workers, people paid from abroad).
    No country names: Rain §7 bars naming a country to suggest who can get the card. */
export const CARD_FOR_YOU_COPY = {
    title: 'Built for money from abroad.',
    body: 'Freelancers, remote workers, anyone with clients in other countries. One balance, spent wherever Visa is accepted.',
} as const

/** The black fold under it: /shhhhh §4 with the second line aimed at the same ICP. */
export const CARD_NOT_FOR_YOU_COPY = {
    title: 'Probably not for you.',
    body1: 'If your money lives in one country and one currency, your bank card already works. Keep it.',
    body2: 'If your income comes from abroad, the Peanut Card was built for you.',
} as const

/** The yellow fold: /shhhhh §2's body and four tiles under Konrad's headline (21 Oct 2026).
    "Platinum" is the card's Visa tier (providers/rain.md); no perks are promised and
    Visa's name is not used as a selling point (Rain §14). */
export const CARD_PLATINUM_COPY = {
    titleLines: ['Platinum.', "But it's pink."],
    body: 'Top up the way you already move money: bank transfer, exchange withdrawal, or stablecoins. Then spend it wherever Visa is accepted.',
} as const

/** /shhhhh's tiles. "150 million merchants" is on Rain's allowed list (§7); the rest are card.md facts. */
export const CARD_STATS = [
    { value: '150M+', label: 'Visa-accepting merchants' },
    { value: '1', label: 'Balance' },
    { value: '0', label: 'Monthly fees' },
    { value: '0', label: 'Annual fees' },
] as const

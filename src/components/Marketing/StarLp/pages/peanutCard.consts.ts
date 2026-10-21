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

/** "Tap. Here's the receipt." fold copy. Konrad iterates it apart from the art (round 3, 21 Oct 2026). */
export const CARD_RECEIPT_FOLD_COPY = {
    title: 'Tap. Here’s the receipt.',
    line: 'Verification and approval required.',
} as const

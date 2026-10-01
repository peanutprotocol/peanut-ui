/**
 * The moments the app may ask for push permission (TASK-23251). The OS dialog
 * is one-shot, so only the pre-prompt in front of it changes with the moment.
 * Each value is also the `trigger` property on the pre-prompt and permission
 * analytics events.
 */
export const PUSH_PROMPT_TRIGGERS = {
    /** the user picks a deposit method or sees bank details / a deposit address */
    DEPOSIT_INTENT: 'deposit_intent',
    REQUEST_CREATED: 'request_created',
    /** the card was just issued, or the add-to-wallet screen is open */
    CARD_READY: 'card_ready',
    /** a payable merchant QR was scanned */
    QR_FIRST_SCAN: 'qr_first_scan',
    /** the context-free Home ask, for users no money moment has reached */
    HOME_FALLBACK: 'home_fallback',
} as const

export type PushPromptTrigger = (typeof PUSH_PROMPT_TRIGGERS)[keyof typeof PUSH_PROMPT_TRIGGERS]

// the Home fallback never asks on the first visits: 58% tapped "Not now" when
// it asked on the first one, before the user had any money with us
export const HOME_FALLBACK_MIN_SESSION = 3

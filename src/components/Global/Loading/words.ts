import type en from '@/i18n/app/messages/en.json'

/* The visible copy lives in the message catalogs under `paymentLoading` so the
   spinner is localized; this list only fixes the rotation pool and the type. */
export type PaymentLoadingWordKey = keyof typeof en.paymentLoading

export const PAYMENT_LOADING_WORD_KEYS = [
    'cracking',
    'smacking',
    'smoothing',
    'stacking',
    'tallying',
    'balancing',
    'doubleChecking',
    'tripleChecking',
    'wiring',
    'shuffling',
    'hustling',
    'slinging',
    'wandering',
    'sayingHola',
    'dodgingFees',
    'outrunningYourBank',
    'skippingTheLine',
    'cuttingTheLine',
    'ditchingWires',
    'bypassingBorders',
    'sneakingPast',
    'sidestepping',
    'goingAround',
    'outsmartingSwift',
    'huntingRates',
    'rateHunting',
    'negotiating',
    'haggling',
    'bartering',
    'chasingTheRate',
    'beatingYourCard',
    'cooking',
    'marinating',
    'yodeling',
] as const satisfies readonly PaymentLoadingWordKey[]

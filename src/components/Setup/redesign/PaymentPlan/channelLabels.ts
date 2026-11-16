import type { IconName } from '@/components/Global/Icons/Icon'
import type { SetupChannel, SetupFundingChannel, SetupPaymentChannel } from '@/features/setup/paymentChannels'

/** A `setupRedesign.plan.*` label key. */
export type PlanLabelKey =
    | 'fundBank'
    | 'fundBankPill'
    | 'fundArsBank'
    | 'fundArsBankPill'
    | 'fundBrlBank'
    | 'fundBrlBankPill'
    | 'fundPeanut'
    | 'fundCrypto'
    | 'payQr'
    | 'payCard'
    | 'payPeanut'
    | 'peanutPill'

/** The drawer row label of each way to add money. `bank` names the server's currencies when known (fundBankCurrencies). */
export const FUNDING_SHEET_KEY: Record<SetupFundingChannel, PlanLabelKey> = {
    bank: 'fundBank',
    arsBank: 'fundArsBank',
    brlBank: 'fundBrlBank',
    crypto: 'fundCrypto',
    peanut: 'fundPeanut',
}

/** The pill label of each way to add money: short enough for the sentence line (es-AR "Banco USD/EUR"). */
export const FUNDING_PILL_KEY: Record<SetupFundingChannel, PlanLabelKey> = {
    bank: 'fundBankPill',
    arsBank: 'fundArsBankPill',
    brlBank: 'fundBrlBankPill',
    crypto: 'fundCrypto',
    peanut: 'peanutPill',
}

/** Spending: the card, QR payments, or another Peanut user where neither is offered. */
export const PAYMENT_SHEET_KEY: Record<SetupPaymentChannel, PlanLabelKey> = {
    card: 'payCard',
    qr: 'payQr',
    peanut: 'payPeanut',
    bank: 'fundBank',
    crypto: 'fundCrypto',
}

export const PAYMENT_PILL_KEY: Record<SetupPaymentChannel, PlanLabelKey> = {
    ...PAYMENT_SHEET_KEY,
    peanut: 'peanutPill',
}

/** The bare app icon a filled pill shows, in ink (mock r3). Pix and Mercado Pago show their brand mark instead. */
export const CHANNEL_ICON: Record<Exclude<SetupChannel, 'brlBank' | 'arsBank'>, IconName> = {
    bank: 'bank',
    crypto: 'coins',
    peanut: 'users',
    card: 'credit-card',
    qr: 'qr-code',
}

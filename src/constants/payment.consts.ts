// fallback account holder name for bridge onramp deposit instructions
// bridge currently doesnt return account_holder_name for faster_payments requests
export const BRIDGE_DEFAULT_ACCOUNT_HOLDER_NAME = 'Bridge Building S.A.'

// Bridge migrated its legal entity (Sp. Z.o.o. -> S.A.) on 2026-06-27. Their
// SEPA deposit instructions can still return the stale old name, and Faster
// Payments omits the name entirely. Map both cases to the current entity so the
// sender's Confirmation-of-Payee check matches (Banking Circle accepts either,
// so payments still settle — this only removes the name-mismatch warning).
// ponytail: drop the legacy check once Bridge's API stops returning "Z.o.o."
export const resolveBridgeAccountHolderName = (name?: string | null): string => {
    if (!name || name.toLowerCase().replace(/[\s.]/g, '').includes('zoo')) {
        return BRIDGE_DEFAULT_ACCOUNT_HOLDER_NAME
    }
    return name
}

// minimum amount requirements for different payment methods (in USD)
export const MIN_BANK_TRANSFER_AMOUNT = 5
export const MIN_MERCADOPAGO_AMOUNT = 5
export const MIN_PIX_AMOUNT = 5

// deposit limits for manteca regional onramps (in USD)
export const MAX_MANTECA_DEPOSIT_AMOUNT = 2000
export const MIN_MANTECA_DEPOSIT_AMOUNT = 1

// withdraw limits for manteca regional offramps (in USD)
export const MAX_MANTECA_WITHDRAW_AMOUNT = 2000
export const MIN_MANTECA_WITHDRAW_AMOUNT = 1

// QR payment limits for manteca (PIX, MercadoPago, QR3)
export const MIN_MANTECA_QR_PAYMENT_AMOUNT = 0.1 // Manteca provider minimum
export const MAX_QR_PAYMENT_AMOUNT_FOREIGN = 2000 // max per transaction for foreign users

// PIX network minimum payment amount (in BRL, not USD)
export const MIN_PIX_AMOUNT_BRL = 1

// Bridge developer fee applied to cross-currency (non-USD) transfers.
// Must match backend BRIDGE_DEVELOPER_FEE_PERCENT in peanut-api-ts/src/bridge/consts.ts.
// Currently 0 — fee was undisclosed in-app while charged via Bridge's email
// receipt. Will re-enable as an FX-rate spread once we ship the quote endpoint.
export const BRIDGE_DEVELOPER_FEE_RATE = 0

/**
 * Static fallback for the card-vs-local-rail markup. The live source of truth
 * is `getCardMarkupRate` in `app/actions/card-comparison.ts` — for ARS that
 * fetches BCRA official live (the spread fluctuates daily), for BRL it just
 * returns the value here (IOF is statutory, slow-moving). These constants
 * cover the static cases AND the eligibility gate (`hasCardMarkupComparison`)
 * — only currencies in this map render the "vs card" surfaces at all.
 *
 * - ARS: 9.13% — historical empirical figure for the BCRA-vs-MEP rate spread
 *        + issuer markup. Used only when the live BCRA fetch fails.
 * - BRL: 7% — IOF on foreign card purchases (3.5% as of 2025, phasing to 0
 *        by 2028) + typical issuer FX markup ~3%. No live source today.
 *
 * Only currencies with a real card-vs-local-rail gap belong here. USD / EUR /
 * GBP / MXN spend doesn't show a meaningful enough delta to be a marketing
 * point and should NOT be added.
 */
export const CARD_FX_MARKUP_BY_CURRENCY: Record<string, number> = {
    ARS: 0.0913,
    BRL: 0.07,
}

/**
 * validate if amount meets minimum requirement for a payment method
 * @param amount - amount in USD
 * @param methodId - payment method identifier
 * @returns true if amount is valid, false otherwise
 */
export const validateMinimumAmount = (amount: number, methodId: string): boolean => {
    const minimums: Record<string, number> = {
        bank: MIN_BANK_TRANSFER_AMOUNT,
        mercadopago: MIN_MERCADOPAGO_AMOUNT,
        pix: MIN_PIX_AMOUNT,
    }
    return amount >= (minimums[methodId] ?? 0)
}

import { isAmountWithinBalance } from '@/utils/balance.utils'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/wallet-token.consts'
import { getMinimumAmount } from '@/utils/bridge.utils'

/**
 * Bridge bank offramps have a $1 wire minimum
 * (https://apidocs.bridge.xyz/docs/transaction-costs). It applies to the USD
 * that leaves, beneath the destination's own minimum (`bankPayoutMinimum`);
 * the submit handler re-checks both synchronously — the amount arrives via a
 * user-editable URL param.
 */
export const BRIDGE_OFFRAMP_MIN_USD = 1

export type WithdrawAmountCheck =
    | { ok: true; normalized: string }
    | { ok: false; reason: 'invalid' | 'belowMinimum' | 'insufficientBalance' | 'balanceLoading' }

/**
 * Fail-closed parse of a user-supplied USD amount string: a finite positive
 * number that round-trips to a plain decimal, or null. The RAW string must be
 * plain-decimal syntax before it is normalized — `Number()` alone also accepts
 * exponential (`5e1`), hex (`0x10`), `Infinity` and whitespace-padded forms,
 * and checking only the normalized output let those through (Chip P13).
 * Downstream `parseUnits` calls throw on scientific notation, so oversized
 * forms (`1e21`) must never survive parsing either (Chip round 7). `.5` and
 * `5.` are tolerated as honest mid-typing decimals.
 *
 * A fraction the token cannot carry is rejected outright. The provider is
 * promised this exact figure and matches the deposit on it, while `parseUnits`
 * rounds a longer fraction rather than throwing — so 5.12345649 told the
 * provider one number and sent 5.123456 on chain, and the transfer waited for
 * funds that had already left. The typed field pins 6 decimals; `?amount=` is
 * user-editable and is the durable store, so the check belongs here.
 */
export function parseUsdAmount(amount: string): string | null {
    if (!/^(\d+\.?\d*|\.\d+)$/.test(amount)) return null
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return null
    const normalized = value.toString()
    if (!/^\d+(\.\d+)?$/.test(normalized)) return null
    if ((normalized.split('.')[1]?.length ?? 0) > PEANUT_WALLET_TOKEN_DECIMALS) return null
    return normalized
}

function checkWithdrawUsdAmount(amount: string, balance: bigint | undefined, minUsd: number): WithdrawAmountCheck {
    const normalized = parseUsdAmount(amount)
    if (normalized === null) return { ok: false, reason: 'invalid' }
    if (Number(normalized) < minUsd) return { ok: false, reason: 'belowMinimum' }
    // an unloaded balance is NOT a pass: without the ceiling an edited
    // ?amount= above the user's funds could reach the provider before the
    // wallet send rejects it (Chip review round 3) — the submit stays
    // disabled until the balance is real
    if (balance === undefined) return { ok: false, reason: 'balanceLoading' }
    if (!isAmountWithinBalance(normalized, balance)) {
        return { ok: false, reason: 'insufficientBalance' }
    }
    return { ok: true, normalized }
}

/**
 * `getMinimumAmount` is keyed by country, and each minimum it holds is in that
 * country's currency. A payout minimum belongs to the currency the account is
 * paid in, not to its country: a Polish IBAN is paid in EUR.
 */
const MINIMUM_COUNTRY_BY_CURRENCY: Record<string, string> = { gbp: 'GB', mxn: 'MX', cop: 'CO' }

/**
 * Bridge's payout minimum in the currency the bank account is paid in: £3,
 * 50 MXN, 4,000 COP, and 1 in every other currency.
 */
export function bankPayoutMinimum(currency: string | null | undefined): number {
    return getMinimumAmount(MINIMUM_COUNTRY_BY_CURRENCY[currency?.toLowerCase() ?? ''] ?? '')
}

/**
 * Whether a bank payout reaches the minimum, compared in the bank's own
 * currency (TASK-23054). `bankAmount` is what the bank receives: the amount
 * the user typed in that currency, or a USD amount times the quote rate. A USD
 * minimum rounded up from the rate refused exactly 50 MXN (it asked for $3,
 * which is 54.60 MXN).
 */
export function meetsBankPayoutMinimum(bankAmount: number, currency: string | null | undefined): boolean {
    return Number.isFinite(bankAmount) && bankAmount >= bankPayoutMinimum(currency)
}

/**
 * Validate + normalize the USD amount right before creating a bank offramp
 * (Chip review, PR #2917): the URL string must be a finite positive number at
 * or above the $1 Bridge floor and within the displayed spendable balance. The
 * normalized decimal string is what goes on the wire — never the raw param.
 * The destination's own minimum is checked in its currency
 * (`meetsBankPayoutMinimum`).
 */
export function validateBankOfframpAmount(amount: string, balance: bigint | undefined): WithdrawAmountCheck {
    return checkWithdrawUsdAmount(amount, balance, BRIDGE_OFFRAMP_MIN_USD)
}

/**
 * Same contract for the crypto withdraw page (Chip review round 4): `?amount=`
 * must be a finite positive plain-decimal within the loaded balance before any
 * request/charge is persisted, and again before broadcast. No rail floor here —
 * same-chain USDC has no minimum (parity with send-via-link); the per-chain
 * Rhino route minimums are enforced separately by the page.
 */
export function validateCryptoWithdrawAmount(amount: string, balance: bigint | undefined): WithdrawAmountCheck {
    return checkWithdrawUsdAmount(amount, balance, 0)
}

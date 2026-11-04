import { parsePix, hasError } from 'pix-utils'
import { parseUnits } from 'viem'
import { isPixEmvcoQr, normalizePixInput, validatePixKey } from '@/utils/withdraw.utils'
import type { AveniaDepositStatus, AveniaWithdrawDisplay, PixKeyInfo } from '@/services/avenia'
import type { RailCapability } from '@/types/capabilities'
import { API_ERROR_CODES } from '@/services/api-error'

/** The Avenia rail of a Brazilian resident: Pix deposits and withdrawals (no QR pay before reliance). */
export const AVENIA_PIX_RAIL_ID = 'avenia.pix_br'

/** R$0.75 fixed on R$10 is 7.5%, so Avenia deposits start at R$20 (plan H2). The eligibility route has the live value. */
export const AVENIA_MIN_DEPOSIT_BRL = 20

export type BrazilPixPath = 'loading' | 'avenia' | 'manteca'

/**
 * Which provider serves a Brazilian Pix deposit or withdrawal for this user.
 *
 * A user who holds the Avenia rail (in any state) uses Avenia. A verified
 * Brazilian resident without it is offered Avenia's first use; the API's
 * rollout gate answers on that step, and a refusal sends the user to the
 * Manteca flow for the rest of the session (`unavailable`). Everyone else
 * keeps the Manteca flow.
 */
export function brazilPixPath({
    isLoading,
    aveniaRail,
    identityVerified,
    verifiedResidence,
    unavailable,
}: {
    isLoading: boolean
    aveniaRail: RailCapability | undefined
    identityVerified: boolean
    verifiedResidence: string | null | undefined
    unavailable: boolean
}): BrazilPixPath {
    if (isLoading) return 'loading'
    if (aveniaRail) return 'avenia'
    if (unavailable) return 'manteca'
    return identityVerified && verifiedResidence?.toUpperCase() === 'BR' ? 'avenia' : 'manteca'
}

/** What the Avenia setup step shows for the rail's capability status. */
export type AveniaSetupState = 'ready' | 'verify' | 'blocked'

export function aveniaSetupState(rail: RailCapability | undefined): AveniaSetupState {
    if (rail?.status === 'enabled') return 'ready'
    if (rail?.status === 'blocked') return 'blocked'
    return 'verify'
}

export type AveniaDepositPhase = 'pending' | 'processing' | 'completed' | 'returned'

// Intent statuses after which nothing more happens to the deposit.
const RETURNED_STATUSES = ['FAILED', 'CANCELLED', 'REFUNDED']
// Ticket statuses that mean the Pix reached Avenia: the money has left the user's bank.
const PAID_TICKET_STATUSES = ['PROCESSING', 'ON-HOLD', 'PAID', 'PARTIAL-FAILED']

/**
 * The deposit screen's phase from GET /avenia/deposit/:intentId. A deposit
 * completes when Rhino's bridge to the wallet is joined to it, so a PAID
 * ticket still reads `processing`. FAILED means Avenia sent the Pix back to
 * the payer (a third-party account, a blocked bank).
 */
export function aveniaDepositPhase(status: AveniaDepositStatus | undefined): AveniaDepositPhase {
    if (!status) return 'pending'
    if (status.status === 'COMPLETED') return 'completed'
    if (RETURNED_STATUSES.includes(status.status)) return 'returned'
    if (status.ticketStatus && PAID_TICKET_STATUSES.includes(status.ticketStatus)) return 'processing'
    return 'pending'
}

/** "9:05" for the time left, or null once it has run out. */
export function countdownLabel(remainingMs: number): string | null {
    if (!(remainingMs > 0)) return null
    const minutes = Math.floor(remainingMs / 60_000)
    const seconds = Math.floor((remainingMs % 60_000) / 1000)
    return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * The payee a bank app shows for a Pix code (EMV tag 59). The deposit screen
 * says it so the name in the bank app is no surprise. Null when the code does
 * not parse.
 */
export function pixCodePayee(brCode: string): string | null {
    try {
        const pix = parsePix(brCode)
        if (hasError(pix)) return null
        const name = 'merchantName' in pix ? pix.merchantName?.trim() : ''
        return name || null
    } catch {
        return null
    }
}

/**
 * The key as the Pix directory holds it, or null while it cannot be a complete
 * key yet. A lookup costs the user's Avenia sub-account DICT tokens (20 for a
 * key that is not found), so an incomplete or malformed key is never sent.
 * A Pix code is not a key: a withdrawal pays to a key.
 */
export function completePixKey(input: string): string | null {
    const key = normalizePixInput(input)
    if (!key || isPixEmvcoQr(key)) return null
    return validatePixKey(key).valid ? key : null
}

export type PixKeyVerdict = 'own' | 'not-own' | 'blocked'

/** Avenia pays out only to the user's own CPF, and never to a bank on its deny-list. */
export function pixKeyVerdict(info: PixKeyInfo): PixKeyVerdict {
    if (info.blocked) return 'blocked'
    return info.ownAccount ? 'own' : 'not-own'
}

/** One amount reaches the API: reais when the user typed reais, else USD. */
export function aveniaWithdrawAmount({
    amountUsd,
    amountBrl,
}: {
    amountUsd: string
    amountBrl: string
}): { amountBrl: string } | { amountUsd: string } | null {
    const brl = toApiDecimal(amountBrl, 2)
    if (brl) return { amountBrl: brl }
    const usd = toApiDecimal(amountUsd, 6)
    return usd ? { amountUsd: usd } : null
}

/** A positive decimal string cut to `decimals` places (the API's amount patterns), or null. */
export function toApiDecimal(value: string, decimals: number): string | null {
    const trimmed = value.trim()
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
    const [whole, fraction = ''] = trimmed.split('.')
    const cut = fraction.slice(0, decimals).replace(/0+$/, '')
    const result = `${BigInt(whole).toString()}${cut ? `.${cut}` : ''}`
    return Number(result) > 0 ? result : null
}

/** "CPF" or "CNPJ" for a masked Brazilian tax id ("***.456.789-**" has 11 positions, a CNPJ 14). */
export function maskedTaxIdKind(masked: string): 'CPF' | 'CNPJ' {
    return masked.replace(/[^\d*]/g, '').length === 14 ? 'CNPJ' : 'CPF'
}

/** The steps of an Avenia Pix withdrawal: the key first, as on the Manteca flow it replaces. */
export const AVENIA_WITHDRAW_STEPS = ['pix-key', 'amount', 'review', 'success'] as const
export type AveniaWithdrawStep = (typeof AVENIA_WITHDRAW_STEPS)[number]

/** The `avenia` catalog key that explains a refused withdrawal preview or init, by wire code. */
export function aveniaWithdrawRefusalKey(
    code: string | undefined
):
    | 'withdraw.errors.limitExceeded'
    | 'withdraw.errors.inProgress'
    | 'withdraw.errors.quoteExpired'
    | 'withdraw.keyNotOwn'
    | 'withdraw.keyBlocked'
    | 'providerRejected'
    | 'unavailable' {
    switch (code) {
        case API_ERROR_CODES.AVENIA_LIMIT_EXCEEDED:
            return 'withdraw.errors.limitExceeded'
        case API_ERROR_CODES.WITHDRAWAL_IN_PROGRESS:
            return 'withdraw.errors.inProgress'
        case API_ERROR_CODES.AVENIA_TICKET_WINDOW_SHORT:
            return 'withdraw.errors.quoteExpired'
        case API_ERROR_CODES.PIX_KEY_NOT_OWN:
            return 'withdraw.keyNotOwn'
        case API_ERROR_CODES.PIX_KEY_BLOCKED:
            return 'withdraw.keyBlocked'
        case API_ERROR_CODES.PROVIDER_REJECTED:
            return 'providerRejected'
        default:
            return 'unavailable'
    }
}

/**
 * How far the opened quote may move against the user before it needs a second
 * Confirm: 10 basis points (0.1%). Init quotes again seconds after the review,
 * and a fixed-reais quote ticks up about half the time; R$0.50 on R$500 is the
 * most this lets through unseen.
 */
export const QUOTE_TOLERANCE_BPS = 10n

/**
 * Whether the quote opened at Confirm is worse for the user than the one they
 * reviewed, beyond {@link QUOTE_TOLERANCE_BPS}: more USD leaves the wallet, or
 * fewer reais arrive. An amount that does not parse counts as worse, so the
 * user sees it before anything is signed.
 */
export function quoteMovedAgainstUser(
    reviewed: Pick<AveniaWithdrawDisplay, 'withdrawUsd' | 'amountBrl'>,
    opened: Pick<AveniaWithdrawDisplay, 'withdrawUsd' | 'amountBrl'>
): boolean {
    try {
        const scale = 10_000n
        const usdOut = parseUnits(opened.withdrawUsd, 6) * scale
        const brlIn = parseUnits(opened.amountBrl, 2) * scale
        return (
            usdOut > parseUnits(reviewed.withdrawUsd, 6) * (scale + QUOTE_TOLERANCE_BPS) ||
            brlIn < parseUnits(reviewed.amountBrl, 2) * (scale - QUOTE_TOLERANCE_BPS)
        )
    } catch {
        return true
    }
}

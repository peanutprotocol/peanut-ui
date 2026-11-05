import { parseUnits } from 'viem'
import { isPixEmvcoQr, normalizePixInput, validatePixKey } from '@/utils/withdraw.utils'
import type { AveniaDepositStatus, AveniaWithdrawDisplay, PixKeyInfo } from '@/services/avenia'
import type { RailCapability } from '@/types/capabilities'
import { API_ERROR_CODES } from '@/services/api-error'
import { aveniaRouteState } from '@/features/avenia/aveniaAvailability'
import { awaitsNewPixKey } from '@/features/avenia/aveniaRecovery'
import type { HistoryEntry } from '@/utils/history.utils'

/** The Avenia rail of a Brazilian resident: Pix deposits and withdrawals (no QR pay before reliance). */
export const AVENIA_PIX_RAIL_ID = 'avenia.pix_br'

/** R$0.75 fixed on R$10 is 7.5%, so Avenia deposits start at R$20 (plan H2). The eligibility route has the live value. */
export const AVENIA_MIN_DEPOSIT_BRL = 20

/** PR B refuses a withdrawal that credits less (`PIX_MIN_AMOUNT`, `AVENIA_MIN_WITHDRAWAL_BRL` in its rules). No route sends it. */
export const AVENIA_MIN_WITHDRAWAL_BRL = 20

export type BrazilPixPath = 'loading' | 'avenia' | 'paused' | 'manteca'

/**
 * Which provider serves a Brazilian Pix deposit or withdrawal for this user.
 *
 * A user who holds the Avenia rail uses Avenia, unless the rollout gate closes
 * it (the Manteca flow, as for a refused first use) or the Avenia kill switch
 * pauses it (`paused`). A verified Brazilian resident without the rail is
 * offered Avenia's first use; the API's rollout gate answers on that step, and
 * a refusal sends the user to the Manteca flow for the rest of the session
 * (`unavailable`). Everyone else keeps the Manteca flow.
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
    if (aveniaRail) {
        const route = aveniaRouteState(aveniaRail)
        if (route === 'paused') return 'paused'
        return route === 'closed' ? 'manteca' : 'avenia'
    }
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

/**
 * One amount reaches the API: reais when the user typed reais, the balance
 * when they tapped it (`spendUsd`: what leaves the wallet, Rhino's fee
 * included, so the whole balance can go), else USD.
 */
export function aveniaWithdrawAmount({
    amountUsd,
    amountBrl,
    spendUsd,
}: {
    amountUsd: string
    amountBrl: string
    spendUsd: string
}): { amountBrl: string } | { spendUsd: string } | { amountUsd: string } | null {
    const brl = toApiDecimal(amountBrl, 2)
    if (brl) return { amountBrl: brl }
    const spend = toApiDecimal(spendUsd, 6)
    if (spend) return { spendUsd: spend }
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

/**
 * What explains a refused withdrawal preview, init or new key, by wire code: an
 * `avenia` catalog key, or `pixKeyNotFound` / `providerRejected` / `minimum`,
 * which `useAveniaRefusalMessage` reads from the shared catalogs.
 */
export type AveniaWithdrawRefusal =
    | 'withdraw.errors.limitExceeded'
    | 'withdraw.errors.inProgress'
    | 'withdraw.errors.quoteExpired'
    | 'withdraw.errors.quoteChanged'
    | 'withdraw.keyNotOwn'
    | 'withdraw.keyBlocked'
    | 'pixKeyNotFound'
    | 'minimum'
    | 'providerRejected'
    | 'unavailable'

export function aveniaWithdrawRefusalKey(code: string | undefined): AveniaWithdrawRefusal {
    switch (code) {
        case API_ERROR_CODES.AVENIA_LIMIT_EXCEEDED:
            return 'withdraw.errors.limitExceeded'
        case API_ERROR_CODES.WITHDRAWAL_IN_PROGRESS:
            return 'withdraw.errors.inProgress'
        case API_ERROR_CODES.AVENIA_TICKET_WINDOW_SHORT:
            return 'withdraw.errors.quoteExpired'
        case API_ERROR_CODES.AVENIA_QUOTE_CHANGED:
            return 'withdraw.errors.quoteChanged'
        case API_ERROR_CODES.PIX_KEY_NOT_OWN:
            return 'withdraw.keyNotOwn'
        case API_ERROR_CODES.PIX_KEY_BLOCKED:
            return 'withdraw.keyBlocked'
        case API_ERROR_CODES.PIX_KEY_NOT_FOUND:
            return 'pixKeyNotFound'
        case API_ERROR_CODES.PIX_MIN_AMOUNT:
            return 'minimum'
        case API_ERROR_CODES.PROVIDER_REJECTED:
            return 'providerRejected'
        default:
            return 'unavailable'
    }
}

/**
 * Whether the sign request asks for exactly the USD the opened quote shows.
 * The user confirms `display.withdrawUsd`; the wallet signs `payAmountUnits`.
 * PR B builds both from Rhino's pay amount, and the app checks they agree
 * before signing anything.
 */
export function signMatchesDisplay(
    display: Pick<AveniaWithdrawDisplay, 'withdrawUsd'>,
    sign: { payAmount: string; payAmountUnits: string }
): boolean {
    try {
        const shown = parseUnits(display.withdrawUsd, 6)
        return BigInt(sign.payAmountUnits) === shown && parseUnits(sign.payAmount, 6) === shown
    } catch {
        return false
    }
}

/**
 * Whether the quote opened at Confirm is worse for the user than the one they
 * reviewed: more USD leaves the wallet, or fewer reais arrive. Any move counts,
 * so the wallet never signs an amount the user has not seen. An amount that
 * does not parse counts as worse.
 */
export function quoteMovedAgainstUser(
    reviewed: Pick<AveniaWithdrawDisplay, 'withdrawUsd' | 'amountBrl'>,
    opened: Pick<AveniaWithdrawDisplay, 'withdrawUsd' | 'amountBrl'>
): boolean {
    try {
        return (
            parseUnits(opened.withdrawUsd, 6) > parseUnits(reviewed.withdrawUsd, 6) ||
            parseUnits(opened.amountBrl, 2) < parseUnits(reviewed.amountBrl, 2)
        )
    } catch {
        return true
    }
}

/**
 * What the last step of a withdrawal says, from its history entry. A mined
 * deposit only funds the withdrawal: Avenia pays the Pix after it, so the
 * step says "on its way" until the entry completes, and asks for another key
 * when the bank refused the payout. An unconfirmed deposit that ended failed
 * or cancelled never reached Rhino, so nothing left the wallet.
 */
export type AveniaWithdrawOutcome = 'on-its-way' | 'unconfirmed' | 'arrived' | 'needs-key' | 'refunded' | 'not-sent'

export function aveniaWithdrawOutcome(
    phase: 'funded' | 'unconfirmed',
    entry: Pick<HistoryEntry, 'status' | 'extraData'> | undefined
): AveniaWithdrawOutcome {
    if (entry?.status === 'COMPLETED') return 'arrived'
    if (awaitsNewPixKey(entry?.extraData)) return 'needs-key'
    if (entry?.status === 'REFUNDED') return 'refunded'
    if (phase === 'unconfirmed' && ['FAILED', 'CANCELLED', 'EXPIRED'].includes(entry?.status ?? '')) return 'not-sent'
    return phase === 'funded' ? 'on-its-way' : 'unconfirmed'
}

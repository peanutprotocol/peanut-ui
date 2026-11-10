import { parseUnits } from 'viem'
import { isPixEmvcoQr, normalizePixInput, validatePixKey } from '@/utils/withdraw.utils'
import type { PixDeposit, PixKeyInfo, PixWithdrawDisplay } from '@/services/pix'
import type { CapabilityRoute, NextActionKind } from '@/types/capabilities'
import { API_ERROR_CODES } from '@/services/api-error'
import { ACTIVATE_ACTION, VERIFY_ACTION } from '@/features/kyc-features/report'
import { awaitsNewPixKey } from '@/features/pix/pixRecovery'
import type { HistoryEntry } from '@/utils/history.utils'

/** The pending route's reasons while the provider reviews the shared verification (api `kyc/capabilities`). */
const IDENTITY_IMPORT_UNAVAILABLE_REASON = 'identity_import_unavailable'
const TAX_ID_MISSING_REASON = 'tax_id_missing'

/**
 * What the Pix setup step shows for the backend's route: the identity check
 * first (`verify`), the provider's terms (the route's action is an
 * `accept-tos` next action), the provider's own identity check on its page
 * where it takes no shared verification (`hosted-verify`, `hosted`: the route
 * waits on one, `pixHostedVerification`), the account the first use opens
 * (`activate`), then the wait while the provider reviews the verification.
 * Refused and paused routes never reach it: the Pix pages show those.
 * Anything else is a case support finishes.
 */
export type PixSetupState = 'ready' | 'verify' | 'accept-terms' | 'hosted-verify' | 'activate' | 'pending' | 'support'

export function pixSetupState(
    route: Pick<CapabilityRoute, 'state' | 'action'> | undefined,
    actionKind: NextActionKind | undefined,
    hosted = false
): PixSetupState {
    switch (route?.state) {
        case 'ready':
            return 'ready'
        case 'pending':
            return 'pending'
        case 'action_required':
            if (hosted) return 'hosted-verify'
            if (route.action === VERIFY_ACTION) return 'verify'
            if (route.action === ACTIVATE_ACTION) return 'activate'
            return actionKind === 'accept-tos' ? 'accept-terms' : 'support'
        default:
            return 'support'
    }
}

/** Why the route waits: the provider reviews, cannot receive the verification yet, or has no CPF for it. */
export type PixPendingReason = 'reviewing' | 'import-unavailable' | 'cpf-missing'

export function pixPendingReason(code: string | undefined): PixPendingReason {
    if (code === TAX_ID_MISSING_REASON) return 'cpf-missing'
    return code === IDENTITY_IMPORT_UNAVAILABLE_REASON ? 'import-unavailable' : 'reviewing'
}

/** The API's arrival estimate in whole minutes, at least one, for the Arrives row. */
export function arrivalMinutes(seconds: number): number {
    return Math.max(1, Math.round(seconds / 60))
}

export type PixDepositPhase = 'pending' | 'processing' | 'completed' | 'returned' | 'expired'

// Intent statuses after which the Pix went back to the payer.
const RETURNED_STATUSES = ['FAILED', 'REFUNDED']

/**
 * The deposit screen's phase from GET /pix/deposit/:intentId. A deposit
 * completes when the USDC reaches the wallet, so a Pix the provider received
 * (`pixReceived`) still reads `processing`. FAILED means the provider sent the
 * Pix back to the payer (a third-party account, a blocked bank). CANCELLED is
 * a code that lapsed unpaid, and no money moved. An unpaid deposit whose code
 * the API no longer calls payable is expired too. No read yet is `pending`.
 */
export function pixDepositPhase(status: PixDeposit | undefined): PixDepositPhase {
    if (!status) return 'pending'
    if (status.status === 'COMPLETED') return 'completed'
    if (status.status === 'CANCELLED') return 'expired'
    if (RETURNED_STATUSES.includes(status.status)) return 'returned'
    if (status.pixReceived) return 'processing'
    // unpaid, and the API no longer sends the code: it lapsed before the poller cancelled it
    return status.codePayable ? 'pending' : 'expired'
}

/**
 * The key as the Pix directory holds it, or null while it cannot be a complete
 * key yet. A lookup can cost the provider directory tokens (more for a key that
 * is not found), so an incomplete or malformed key is never sent.
 * A Pix code is not a key: a withdrawal pays to a key.
 */
export function completePixKey(input: string): string | null {
    const key = normalizePixInput(input)
    if (!key || isPixEmvcoQr(key)) return null
    return validatePixKey(key).valid ? key : null
}

/** `unchecked`: the provider cannot tell whose key it is (`ownAccount` null), and it pays any key. */
export type PixKeyVerdict = 'own' | 'not-own' | 'blocked' | 'unchecked'

/** A provider that checks the holder pays only the user's own CPF; none pays a bank on its deny-list. */
export function pixKeyVerdict(info: PixKeyInfo): PixKeyVerdict {
    if (info.blocked) return 'blocked'
    if (info.ownAccount === null) return 'unchecked'
    return info.ownAccount ? 'own' : 'not-own'
}

/**
 * One amount reaches the API: reais when the user typed reais, the balance
 * when they tapped it (`spendUsd`: what leaves the wallet, every fee
 * included, so the whole balance can go), else USD.
 */
export function pixWithdrawAmount({
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

/** The steps of a Pix withdrawal: the key first. */
export const PIX_WITHDRAW_STEPS = ['pix-key', 'amount', 'review', 'success'] as const
export type PixWithdrawStep = (typeof PIX_WITHDRAW_STEPS)[number]

/**
 * What explains a refused withdrawal preview, init or new key, by wire code: an
 * `pix` catalog key, or `pixKeyNotFound` / `providerRejected` / `minimum`,
 * which `usePixRefusalMessage` reads from the shared catalogs.
 */
export type PixWithdrawRefusal =
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

export function pixWithdrawRefusalKey(code: string | undefined): PixWithdrawRefusal {
    switch (code) {
        case API_ERROR_CODES.PIX_LIMIT_EXCEEDED:
            return 'withdraw.errors.limitExceeded'
        case API_ERROR_CODES.WITHDRAWAL_IN_PROGRESS:
            return 'withdraw.errors.inProgress'
        case API_ERROR_CODES.PIX_QUOTE_EXPIRED:
            return 'withdraw.errors.quoteExpired'
        case API_ERROR_CODES.PIX_QUOTE_CHANGED:
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
 * The API builds both from the same pay amount, and the app checks they
 * agree before signing anything.
 */
export function signMatchesDisplay(
    display: Pick<PixWithdrawDisplay, 'withdrawUsd'>,
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
    reviewed: Pick<PixWithdrawDisplay, 'withdrawUsd' | 'amountBrl'>,
    opened: Pick<PixWithdrawDisplay, 'withdrawUsd' | 'amountBrl'>
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
 * What the last step of a withdrawal says, from its history entry. A funding
 * transaction only funds the withdrawal: the provider pays the Pix after it,
 * so the step says "on its way" until the entry completes, and asks for
 * another key when the bank refused the payout. An unconfirmed funding that
 * ended failed or cancelled never reached the provider, so nothing left the
 * wallet.
 *
 * `phase` is what this device knows of the deposit: `funded` (mined),
 * `unconfirmed` (it may have gone out: no receipt, or a reload after the
 * wallet was asked to sign), `unsigned` (a reload, and the wallet was never
 * asked, or the signature surely sent nothing). An unsigned withdrawal the API
 * still holds for its signature (AWAITING_USER_ACTION) is not sent: this page
 * lost the signature request, so it starts again.
 */
export type PixWithdrawOutcomeKind =
    | 'on-its-way'
    | 'unconfirmed'
    | 'arrived'
    | 'needs-key'
    | 'refunded'
    | 'not-sent'
    | 'stuck'

/** How the API ends a withdrawal whose deposit never left the wallet. */
const ENDED_UNFUNDED = ['FAILED', 'CANCELLED', 'EXPIRED']

export function pixWithdrawOutcome(
    phase: 'funded' | 'unconfirmed' | 'unsigned',
    entry: Pick<HistoryEntry, 'status' | 'extraData'> | undefined
): PixWithdrawOutcomeKind {
    if (entry?.status === 'COMPLETED') return 'arrived'
    if (awaitsNewPixKey(entry?.extraData)) return 'needs-key'
    if (entry?.status === 'REFUNDED') return 'refunded'
    if (entry?.status && entry.status !== 'PENDING') {
        if (phase !== 'funded' && ENDED_UNFUNDED.includes(entry.status)) return 'not-sent'
        // a funded deposit whose withdrawal ended with no recovery, or an end this build does not
        // know: support sorts it out, and the screen never reads as progress
        return 'stuck'
    }
    // the API saw the funding (reported, or found on chain): the provider pays next
    if (entry?.extraData?.intentStatus === 'PROCESSING') return 'on-its-way'
    if (phase === 'unsigned' && entry?.extraData?.intentStatus === 'AWAITING_USER_ACTION') return 'not-sent'
    return phase === 'funded' ? 'on-its-way' : 'unconfirmed'
}

/**
 * The exchange rate the withdraw review shows, in BRL per USD, to 6 decimals: the
 * reais that arrive plus the flat fee, over the USD as the screen rounds it (half-up
 * to the cent). The API's all-in rate is over the exact USD; over the rounded one, the
 * three numbers on screen agree to the centavo (USD × rate − fee = reais).
 */
export function pixShownRate(
    display: Pick<PixWithdrawDisplay, 'amountBrl' | 'fixedFeeBrl' | 'withdrawUsd' | 'rate'>
): string {
    const shownUsd = Math.round(Number(display.withdrawUsd) * 100) / 100
    if (!(shownUsd > 0)) return display.rate
    return ((Number(display.amountBrl) + Number(display.fixedFeeBrl)) / shownUsd).toFixed(6)
}

import { isAddressStepGate } from '@/features/deposit-accounts/addressStep'
import { supportRefusal } from '@/features/kyc-features/report'
import type { VerifySource } from '@/features/paperwork-verification/verifySource'
import type { FeatureReportEntry, IdentityVerificationStatus } from '@/types/capabilities'
import { gateFromEntry, type CapabilityState, type GateState } from '@/utils/capability-gate'

/**
 * "ID verified": where a self-started verification ends, with the ways to add money (add-money proposal,
 * rules 1-3). The bank_ready push and the reminder open it again with `?variant=bank-ready`.
 */
export const VERIFIED_PAGE_PATH = '/verified'
export const VERIFIED_PAGE_VARIANTS = ['verified', 'bank-ready'] as const
export type VerifiedPageVariant = (typeof VERIFIED_PAGE_VARIANTS)[number]

/** how long the bank rows may load in place after approval, as the old "Setting up account" modal waited */
export const VERIFIED_ROWS_SETTLE_MS = 30_000

// a person who starts the check on their own ends on the page; a check started inside a task
// (bank deposit, card, claim, QR pay, withdraw) returns to that task
const SELF_STARTED: readonly VerifySource[] = ['signup', 'home', 'payment_methods', 'direct']

export const isSelfStartedVerification = (source: VerifySource | null | undefined): boolean =>
    !!source && SELF_STARTED.includes(source)

/**
 * What a bank row says (Aleks's state words): loading while the account opens, ready, open (offered, its tap
 * opens it), review (the provider decides), action (the person has a step), refused.
 */
export type BankRowState = 'loading' | 'ready' | 'open' | 'review' | 'action' | 'refused'

/** `settled`: the wait after approval is over, so an account the provider still sets up is under review */
export function bankRowState(gate: GateState, settled: boolean): BankRowState {
    switch (gate.kind) {
        case 'ready':
            return 'ready'
        case 'accept-tos':
        case 'fixable-rejection':
        case 'provide-email':
        case 'restart-identity':
            return 'action'
        case 'blocked-rejection':
            return 'refused'
        case 'waiting-on-provider':
            return 'review'
        case 'pending':
            return settled ? 'review' : 'loading'
        case 'needs-enrollment':
            // the API's settled answer for an account not opened on approval (`ready`, `activate` for a verify-once
            // identity): the row opens it now
            return 'open'
        default:
            // not read yet, or a read that has not caught up with the approval; after the wait the row opens the hub
            return settled ? 'open' : 'loading'
    }
}

/**
 * A bank row's gate and state from its feature report entry (none: not read yet). Only a provider's own refusal
 * reads "Not approved"; a refusal by residence is a row the bank hub explains, so it stays open.
 */
export function verifiedRow(
    entry: FeatureReportEntry | undefined,
    capabilities: Pick<CapabilityState, 'rails' | 'nextActions'>,
    settled: boolean
): { gate: GateState; state: BankRowState } {
    if (!entry) return { gate: { kind: 'loading' }, state: bankRowState({ kind: 'loading' }, settled) }
    const gate = gateFromEntry(entry, capabilities)
    const providerRefusal =
        gate.kind !== 'blocked-rejection' || gate.byIdentity || !!supportRefusal(entry, capabilities.nextActions)
    return { gate, state: providerRefusal ? bankRowState(gate, settled) : 'open' }
}

/** the step an action row names: Bridge's terms or the proof of address; null for any other step */
export function actionStep(gate: GateState): 'terms' | 'address' | null {
    if (gate.kind === 'accept-tos') return 'terms'
    return isAddressStepGate(gate) ? 'address' : null
}

/** the name chip's green check shows once at least one provider account works (Aleks) */
export const anyBankReady = (states: readonly BankRowState[]) => states.includes('ready')

/** crypto says it works now when no bank row can take money yet and none is still loading */
export const cryptoWorksNow = (states: readonly BankRowState[]) =>
    !states.some((state) => state === 'ready' || state === 'open' || state === 'loading')

// an approval this tab just saw: the page opens before the user read catches up, which may still say
// action_required or not_started (Chip on #4317). Session storage, gone with the tab; no personal data.
const APPROVED_AT_KEY = 'peanut:verified-approved-at'
const APPROVAL_FRESH_MS = 2 * 60_000

/** called by every route onto the page at the approval it saw */
export function markIdentityApproved() {
    try {
        window.sessionStorage.setItem(APPROVED_AT_KEY, String(Date.now()))
    } catch {
        // private mode: the page waits for the user read only while it says processing
    }
}

/** whether this tab saw an approval in the last two minutes */
export function identityJustApproved(): boolean {
    try {
        const at = Number(window.sessionStorage.getItem(APPROVED_AT_KEY))
        return !!at && Date.now() - at < APPROVAL_FRESH_MS
    } catch {
        return false
    }
}

/**
 * Whether the page may say "verified": only to a verified identity. While the user read lags an approval (it says
 * processing, or this tab just saw the approval) the page waits; once the wait is over, or for anyone else, it
 * leaves for Home. `undefined`: the user is not read yet, or carries no status.
 */
export function verifiedPageAccess(
    status: IdentityVerificationStatus | undefined,
    settled: boolean,
    justApproved = false
): 'show' | 'wait' | 'leave' {
    if (status === 'verified') return 'show'
    // no status (the read failed or carries none) or one that lags the approval: wait, then leave like anyone else
    if (!settled && (status === undefined || status === 'processing' || justApproved)) return 'wait'
    return 'leave'
}

// One visit: from opening the page until leaving it any way but a row. A row's flow comes back to a return path
// that carries a one-time token; only that way back is the same visit. Any other opening (Home, a link, the
// bank-ready reminder) has no token, so it is a new visit even if a row's flow was abandoned (Chip on #4317).
const ROW_RETURN_KEY = 'peanut:verified-row-return'
export const VISIT_PARAM = 'visit'

/** the path a row's flow returns to, with a fresh one-time token for this visit */
export function rowReturnPath(variant: VerifiedPageVariant): string {
    const token = String(Date.now())
    try {
        window.sessionStorage.setItem(ROW_RETURN_KEY, token)
    } catch {
        // private mode: the return counts as a new visit
    }
    const params = new URLSearchParams(variant === 'bank-ready' ? { variant } : {})
    params.set(VISIT_PARAM, token)
    return `${VERIFIED_PAGE_PATH}?${params}`
}

/** whether this opening is a row's way back (its token matches the one stored); a token works once */
export function returningFromRow(token: string | null): boolean {
    try {
        const stored = window.sessionStorage.getItem(ROW_RETURN_KEY)
        if (!token || token !== stored) return false
        window.sessionStorage.removeItem(ROW_RETURN_KEY)
        return true
    } catch {
        return false
    }
}

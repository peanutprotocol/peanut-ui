import { isAddressStepGate } from '@/features/deposit-accounts/addressStep'
import { supportRefusal } from '@/features/kyc-features/report'
import type { VerifySource } from '@/features/paperwork-verification/verifySource'
import type { FeatureReportEntry } from '@/types/capabilities'
import { gateFromEntry, type CapabilityState, type GateState } from '@/utils/capability-gate'

/**
 * "Your ID is verified": where a self-started verification ends, with the ways to add money (add-money proposal,
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
        default:
            // not read yet, or the approval not reflected yet; after the wait the row opens the bank hub
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

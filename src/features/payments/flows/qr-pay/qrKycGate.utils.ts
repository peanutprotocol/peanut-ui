import {
    IDENTITY_DOCUMENT_MISSING_CODE,
    IDENTITY_REGION_RESTRICTED_CODE,
    PROVIDER_ID_REQUEST_REASONS,
    QR_IDENTITY_MISSING_CODE,
    QR_IDENTITY_RESTART_PENDING_CODE,
    QrKycState,
} from '@/constants/kyc.consts'
import type { KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import type { FeatureReport, NextAction, RailCapability } from '@/types/capabilities'
import { entryAction, VERIFY_ACTION } from '@/features/kyc-features/report'

/**
 * The verification QR pay starts. Any verified user gets the QR pool rails,
 * whatever their residence, so this is also the ID check for a user whose
 * residence rules out bank rails and the card (Home's Verify row, the
 * "Unlock QR payments" slide).
 */
export const QR_IDENTITY_CHECK_INTENT: KYCRegionIntent = 'LATAM'

export interface QrKycGate {
    kycGateState: QrKycState
    qrKycUserMessage: string | null
    qrKycActionKey: string | null
}

/**
 * The QR-pay KYC gate: the API's QR answer (`capabilities.features.qr`). The
 * one answer to "can this user pay a QR, and if not, why": the QR pay page,
 * Money settings and the Home checklist all read it, so they cannot disagree.
 */
export function selectQrKycGate(input: {
    isLoading: boolean
    features: FeatureReport | undefined
    nextActions: readonly NextAction[]
}): QrKycGate {
    const gate = (
        kycGateState: QrKycState,
        qrKycUserMessage: string | null = null,
        qrKycActionKey: string | null = null
    ) => ({
        kycGateState,
        qrKycUserMessage,
        qrKycActionKey,
    })
    if (input.isLoading) return gate(QrKycState.LOADING)
    // No report is a visitor with no account yet: verification is their way in.
    if (!input.features) return gate(QrKycState.REQUIRES_IDENTITY_VERIFICATION)
    const entry = input.features.qr
    const action = entryAction(entry, input.nextActions)
    const message = entry.message || null
    switch (entry.state) {
        case 'on':
            return gate(QrKycState.PROCEED_TO_PAY)
        case 'refused':
            // A terminal decision on the ID: verification can no longer be offered, for any rail.
            if (entry.reason === IDENTITY_REGION_RESTRICTED_CODE) return gate(QrKycState.REGION_RESTRICTED)
            if (action?.kind === 'restart-identity') return gate(QrKycState.PROVIDER_RESTART_IDENTITY, message)
            return gate(QrKycState.PROVIDER_REJECTION_BLOCKED, message)
        case 'action_required':
            if (entry.action === VERIFY_ACTION) return gate(QrKycState.REQUIRES_IDENTITY_VERIFICATION)
            if (action?.kind === 'restart-identity') return gate(QrKycState.PROVIDER_RESTART_IDENTITY, message)
            // This surface has no email form; the blocked ending sends the user to support.
            if (action?.kind === 'provide-email') return gate(QrKycState.PROVIDER_REJECTION_BLOCKED, message)
            return gate(QrKycState.PROVIDER_REJECTION_FIXABLE, message, action?.kind === 'sumsub' ? action.key : null)
        case 'setting_up':
        case 'pending':
            return gate(QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS)
        case 'ready':
            return gate(QrKycState.REQUIRES_IDENTITY_VERIFICATION)
    }
}

/**
 * Causes whose verification step is the identity restart, not a new check,
 * in the order the verify-again screen explains them: an imported account with
 * no ID on file, a new ID check the user has not finished, an ID whose name or
 * number the payment partner cannot use, a provider asking for a new ID.
 */
const IDENTITY_RESTART_ORDER = [
    IDENTITY_DOCUMENT_MISSING_CODE,
    QR_IDENTITY_RESTART_PENDING_CODE,
    QR_IDENTITY_MISSING_CODE,
    ...PROVIDER_ID_REQUEST_REASONS,
] as const
export type QrIdentityRestartReason = (typeof IDENTITY_RESTART_ORDER)[number]
const IDENTITY_RESTART_REASONS: ReadonlySet<string> = new Set(IDENTITY_RESTART_ORDER)

/** Which restart cause the QR screen explains, from the actions and the Manteca rails; null when none applies. */
export function qrIdentityRestartReason(input: {
    mantecaRails: RailCapability[]
    nextActions: NextAction[]
}): QrIdentityRestartReason | null {
    const named = new Set([
        ...input.nextActions.filter((action) => action.kind === 'restart-identity').map((action) => action.purpose),
        ...input.mantecaRails.map((rail) => rail.resolved?.blocking?.code ?? rail.reason?.code ?? ''),
    ])
    return IDENTITY_RESTART_ORDER.find((code) => named.has(code)) ?? null
}

/**
 * Whether the QR verification step must restart the identity check. In both
 * causes the user is approved, so the start route answers "already approved"
 * and opens nothing (TASK-22698). The rail reason is read as well as the action
 * purpose: the backend shares one `restart-identity` action between causes and
 * names it after the first one.
 */
export function qrVerificationNeedsRestart(input: {
    mantecaRails: RailCapability[]
    nextActions: NextAction[]
}): boolean {
    const isRestartAction = (action: NextAction) =>
        action.kind === 'restart-identity' && IDENTITY_RESTART_REASONS.has(action.purpose)
    if (input.nextActions.some(isRestartAction)) return true
    return input.mantecaRails.some((rail) =>
        IDENTITY_RESTART_REASONS.has(rail.resolved?.blocking?.code ?? rail.reason?.code ?? '')
    )
}

/**
 * Whether QR pay is a path for the user: now (PROCEED_TO_PAY), or once
 * verified, reviewed or fixed (requires verification, in progress, fixable,
 * restart with another ID). Not a path when a provider blocks it or the
 * region is refused. `undefined` while the gate is loading.
 */
export function qrPayIsAPath(state: QrKycState): boolean | undefined {
    switch (state) {
        case QrKycState.LOADING:
            return undefined
        case QrKycState.PROVIDER_REJECTION_BLOCKED:
        case QrKycState.REGION_RESTRICTED:
            return false
        default:
            return true
    }
}

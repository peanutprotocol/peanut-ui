import { QrKycState } from '@/constants/kyc.consts'
import type { NextAction, RailCapability } from '@/types/capabilities'
import { railUserMessage, railVerdict } from '@/utils/capability-gate'

export interface QrKycGate {
    kycGateState: QrKycState
    qrKycUserMessage: string | null
    qrKycActionKey: string | null
}

/**
 * The QR-pay KYC gate, from the backend capability model. The one answer to
 * "can this user pay a QR, and if not, why": the QR pay page and the Home
 * checklist both read it, so they cannot disagree.
 *
 * `canPayManteca` is `canDo('pay', { provider: 'manteca' })`; `mantecaRails`
 * is `railsForProvider('manteca')`.
 */
export function selectQrKycGate(input: {
    isLoading: boolean
    isRegionRestricted: boolean
    canPayManteca: boolean
    mantecaRails: RailCapability[]
    nextActions: NextAction[]
}): QrKycGate {
    const noAction = null as string | null
    if (input.isLoading) {
        return { kycGateState: QrKycState.LOADING, qrKycUserMessage: noAction, qrKycActionKey: noAction }
    }
    // Above the enabled-pay return, not just the rail-derived states below.
    // A terminal jurisdictional refusal is account-wide, but nothing revokes
    // a pool rail granted by an earlier approval — so a residence change
    // that re-verifies into a region rejection leaves an ENABLED rail
    // behind, and ranking `canDo` first would keep the money path open on
    // an identity we can no longer verify. Deliberately unlike deriveGate's
    // ready-wins hoist, which exists to stop a STUCK SIBLING rail from
    // blocking a working one — a refused identity is not a sibling rail.
    if (input.isRegionRestricted) {
        return { kycGateState: QrKycState.REGION_RESTRICTED, qrKycUserMessage: noAction, qrKycActionKey: noAction }
    }
    if (input.canPayManteca) {
        return { kycGateState: QrKycState.PROCEED_TO_PAY, qrKycUserMessage: noAction, qrKycActionKey: noAction }
    }
    // Verdict-first via the shared railVerdict collapse (rail.resolved,
    // BE-derived; legacy fallback for older/cached responses). The
    // US-nationality refinement is applied in the resolver itself
    // (Sumsub-approved + US-restricted → operations.pay enabled, caught by
    // canDo above), so a blocked verdict is genuine.
    const actionByKey = new Map(input.nextActions.map((action) => [action.key, action]))
    const candidates = input.mantecaRails.map((rail) => ({
        rail,
        verdict: railVerdict(rail, actionByKey),
    }))
    // provide-email is NOT a document fix: routing it into the Sumsub
    // upload flow dead-ends the user, and this surface has no email form —
    // map it to the blocked modal (same rule as deriveProviderRejection).
    const isProvideEmail = ({ verdict }: (typeof candidates)[number]) =>
        verdict.blocking?.selfHealKind === 'provide-email'
    const blocked = candidates.find((candidate) => candidate.verdict.status === 'blocked' || isProvideEmail(candidate))
    if (blocked) {
        // Country-not-supported is self-fixable: user uploaded a non-AR/BR doc
        // and can verify again with a different one. Split out for the right CTA.
        // (selfHealKind is the verdict home; the reason-code check covers legacy
        // responses — the code rides on blocking.code verbatim.)
        if (
            !isProvideEmail(blocked) &&
            (blocked.verdict.blocking?.selfHealKind === 'restart-identity' ||
                blocked.verdict.blocking?.code === 'country_not_supported')
        ) {
            return {
                kycGateState: QrKycState.PROVIDER_RESTART_IDENTITY,
                qrKycUserMessage: railUserMessage(blocked.rail),
                qrKycActionKey: noAction,
            }
        }
        return {
            kycGateState: QrKycState.PROVIDER_REJECTION_BLOCKED,
            qrKycUserMessage: railUserMessage(blocked.rail),
            qrKycActionKey: noAction,
        }
    }
    const fixable = candidates.find((candidate) => candidate.verdict.status === 'fixable')
    if (fixable) {
        const action = fixable.verdict.nextAction
        return {
            kycGateState: QrKycState.PROVIDER_REJECTION_FIXABLE,
            qrKycUserMessage: railUserMessage(fixable.rail),
            qrKycActionKey: action?.kind === 'sumsub' ? action.key : noAction,
        }
    }
    if (candidates.some(({ verdict }) => verdict.status === 'pending')) {
        return {
            kycGateState: QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS,
            qrKycUserMessage: noAction,
            qrKycActionKey: noAction,
        }
    }
    return {
        kycGateState: QrKycState.REQUIRES_IDENTITY_VERIFICATION,
        qrKycUserMessage: noAction,
        qrKycActionKey: noAction,
    }
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

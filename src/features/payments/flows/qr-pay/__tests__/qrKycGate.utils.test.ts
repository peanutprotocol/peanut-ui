import { featureReport } from '@/test-utils/featureReport.fixture'
/**
 * The QR-pay KYC gate is the one source for "can this user pay a QR". The QR
 * pay page and the Home checklist both read it (TASK-23054). QR pay is open to
 * every verified user anywhere: the API enables the Manteca pool rails on
 * every ID approval, so a new user with no Manteca rail yet is "verify first",
 * never "no QR".
 */
import { QrKycState } from '@/constants/kyc.consts'
import type { FeatureReportEntry, NextAction, RailCapability } from '@/types/capabilities'
import { qrIdentityRestartReason, qrPayIsAPath, qrVerificationNeedsRestart, selectQrKycGate } from '../qrKycGate.utils'

const pix = (overrides: Partial<RailCapability> = {}) =>
    ({
        id: 'manteca.pix_br',
        provider: 'manteca',
        method: 'PIX_BR',
        channel: 'bank',
        country: 'BR',
        currency: 'BRL',
        status: 'enabled',
        ...overrides,
    }) as RailCapability

const report = (qr: FeatureReportEntry) => ({
    ...featureReport({ rails: [], nextActions: [], identity: { status: 'not_started' }, residence: null }),
    qr,
})
const gate = (qr?: FeatureReportEntry, nextActions: NextAction[] = [], isLoading = false) =>
    selectQrKycGate({ isLoading, features: qr ? report(qr) : undefined, nextActions })

describe('selectQrKycGate reads the API QR entry', () => {
    it('loading → LOADING even with an on report', () => {
        expect(gate({ state: 'on' }, [], true).kycGateState).toBe(QrKycState.LOADING)
    })
    it('an on entry → PROCEED_TO_PAY', () => {
        expect(gate({ state: 'on' }).kycGateState).toBe(QrKycState.PROCEED_TO_PAY)
    })
    it('an ID check reported as refused → PROVIDER_REJECTION_BLOCKED, not Unlock now', () => {
        const result = gate({ state: 'refused', reason: 'identity_rejected', message: 'Final decision' })
        expect(result).toEqual({
            kycGateState: QrKycState.PROVIDER_REJECTION_BLOCKED,
            qrKycUserMessage: 'Final decision',
            qrKycActionKey: null,
        })
        expect(qrPayIsAPath(result.kycGateState)).toBe(false)
    })
    it('an on report stays usable regardless of identity decisions on other features', () => {
        const features = report({ state: 'on' })
        features.bank = { state: 'refused', reason: 'identity_rejected', accounts: {} }
        expect(selectQrKycGate({ features, nextActions: [], isLoading: false }).kycGateState).toBe(
            QrKycState.PROCEED_TO_PAY
        )
    })
    it('a new visitor without a report → REQUIRES_IDENTITY_VERIFICATION', () => {
        expect(gate().kycGateState).toBe(QrKycState.REQUIRES_IDENTITY_VERIFICATION)
        expect(gate({ state: 'action_required', action: 'verify' }).kycGateState).toBe(
            QrKycState.REQUIRES_IDENTITY_VERIFICATION
        )
        expect(gate({ state: 'ready' }).kycGateState).toBe(QrKycState.REQUIRES_IDENTITY_VERIFICATION)
    })
    it('a setting_up or pending entry → IDENTITY_VERIFICATION_IN_PROGRESS', () => {
        for (const state of ['setting_up', 'pending'] as const)
            expect(gate({ state }).kycGateState).toBe(QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS)
    })
    it('a named Sumsub action → PROVIDER_REJECTION_FIXABLE with the exact action key', () => {
        const nextAction: NextAction = {
            key: 'sumsub:resubmit',
            kind: 'sumsub',
            purpose: 'unlock-manteca',
            levelKey: 'x',
        }
        expect(
            gate({ state: 'action_required', action: nextAction.key, message: 'Upload again' }, [nextAction])
        ).toEqual({
            kycGateState: QrKycState.PROVIDER_REJECTION_FIXABLE,
            qrKycUserMessage: 'Upload again',
            qrKycActionKey: nextAction.key,
        })
    })
    it('a named identity restart → PROVIDER_RESTART_IDENTITY', () => {
        const action: NextAction = { key: 'restart-identity', kind: 'restart-identity', purpose: 'identity_missing' }
        for (const state of ['action_required', 'refused'] as const)
            expect(gate({ state, action: action.key, message: 'Try another ID' }, [action])).toEqual({
                kycGateState: QrKycState.PROVIDER_RESTART_IDENTITY,
                qrKycUserMessage: 'Try another ID',
                qrKycActionKey: null,
            })
    })
    it('a refused entry → PROVIDER_REJECTION_BLOCKED', () => {
        expect(gate({ state: 'refused' }).kycGateState).toBe(QrKycState.PROVIDER_REJECTION_BLOCKED)
    })
    it('a region refusal in the report → REGION_RESTRICTED', () => {
        expect(gate({ state: 'refused', reason: 'identity_region_restricted' }).kycGateState).toBe(
            QrKycState.REGION_RESTRICTED
        )
    })
    it('an email action uses the support ending and an unreferenced restart does not override the report', () => {
        const email: NextAction = { key: 'email', kind: 'provide-email', purpose: 'missing' }
        const restart: NextAction = { key: 'restart', kind: 'restart-identity', purpose: 'identity_missing' }
        expect(gate({ state: 'action_required', action: email.key }, [email, restart]).kycGateState).toBe(
            QrKycState.PROVIDER_REJECTION_BLOCKED
        )
        expect(gate({ state: 'on' }, [restart]).kycGateState).toBe(QrKycState.PROCEED_TO_PAY)
        expect(gate({ state: 'action_required', action: 'missing' }, [restart]).qrKycActionKey).toBeNull()
    })
})

/**
 * An approved user whose identity evidence is missing: the start route answers
 * "already approved" and opens nothing, so the QR verification step must be
 * the identity restart (TASK-22698).
 */
describe('qrVerificationNeedsRestart', () => {
    const restart = (purpose: string) => ({ key: 'restart-identity', kind: 'restart-identity', purpose }) as NextAction
    const needsRestart = (input: Partial<Parameters<typeof qrVerificationNeedsRestart>[0]>) =>
        qrVerificationNeedsRestart({ mantecaRails: [], nextActions: [], ...input })

    it('an approval with no identity document on file → restart', () => {
        expect(needsRestart({ nextActions: [restart('identity_document_missing')] })).toBe(true)
    })

    it('QR rails paused for missing identity evidence → restart', () => {
        expect(needsRestart({ nextActions: [restart('identity_missing')] })).toBe(true)
    })

    it('reads the rail reason when the shared action names another cause', () => {
        const rail = pix({
            status: 'blocked',
            reason: { code: 'identity_missing', userMessage: 'Verify your identity again to restore QR payments.' },
        })
        expect(needsRestart({ mantecaRails: [rail], nextActions: [restart('country_not_supported')] })).toBe(true)
    })

    it('a document from an unsupported country → no restart here (the rejection screen owns it)', () => {
        expect(needsRestart({ nextActions: [restart('country_not_supported')] })).toBe(false)
    })

    it('nothing to restart → the regular start', () => {
        expect(needsRestart({ mantecaRails: [pix()] })).toBe(false)
    })
})

describe('qrPayIsAPath — what the Home checklist reads', () => {
    it.each([
        QrKycState.PROCEED_TO_PAY,
        QrKycState.REQUIRES_IDENTITY_VERIFICATION,
        QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS,
        QrKycState.PROVIDER_REJECTION_FIXABLE,
        QrKycState.PROVIDER_RESTART_IDENTITY,
    ])('%s → a path (now, or once verified or fixed)', (state) => {
        expect(qrPayIsAPath(state)).toBe(true)
    })

    it.each([QrKycState.PROVIDER_REJECTION_BLOCKED, QrKycState.REGION_RESTRICTED])('%s → no path', (state) => {
        expect(qrPayIsAPath(state)).toBe(false)
    })

    it('LOADING → unknown', () => {
        expect(qrPayIsAPath(QrKycState.LOADING)).toBeUndefined()
    })
})

/**
 * Slava, 2026-10-26: the verify-again screen says why QR stopped. Each cause
 * has its own words, and the first that applies wins.
 */
describe('qrIdentityRestartReason', () => {
    const restart = (purpose: string) => ({ key: 'restart-identity', kind: 'restart-identity', purpose }) as NextAction
    const paused = (code: string) => pix({ status: 'blocked', reason: { code, userMessage: '' } })
    const reason = (input: Partial<Parameters<typeof qrIdentityRestartReason>[0]>) =>
        qrIdentityRestartReason({ mantecaRails: [], nextActions: [], ...input })

    it('names an unfinished new ID check from the paused rail', () => {
        expect(reason({ mantecaRails: [paused('identity_restart_pending')] })).toBe('identity_restart_pending')
        expect(needsRestartFor('identity_restart_pending')).toBe(true)
    })

    it('names an ID the payment partner cannot read', () => {
        expect(reason({ nextActions: [restart('identity_missing')] })).toBe('identity_missing')
    })

    it('puts an imported account with no ID on file first', () => {
        expect(
            reason({
                mantecaRails: [paused('identity_missing')],
                nextActions: [restart('identity_document_missing')],
            })
        ).toBe('identity_document_missing')
    })

    it('is null when nothing needs the restart', () => {
        expect(reason({ mantecaRails: [pix()], nextActions: [restart('country_not_supported')] })).toBeNull()
    })

    it.each(['id_expired', 'id_verification_failed', 'identity_verification_required'])(
        'names a provider asking for a new ID (%s), so the verify step restarts instead of answering "already approved"',
        (code) => {
            expect(reason({ nextActions: [restart(code)] })).toBe(code)
            expect(needsRestartFor(code)).toBe(true)
        }
    )

    it('an unfinished new ID check outranks the provider ask it answers', () => {
        expect(
            reason({ mantecaRails: [paused('identity_restart_pending')], nextActions: [restart('id_expired')] })
        ).toBe('identity_restart_pending')
    })
})

function needsRestartFor(code: string) {
    return qrVerificationNeedsRestart({
        mantecaRails: [pix({ status: 'blocked', reason: { code, userMessage: '' } })],
        nextActions: [],
    })
}

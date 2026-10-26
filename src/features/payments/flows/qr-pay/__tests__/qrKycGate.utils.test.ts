/**
 * The QR-pay KYC gate is the one source for "can this user pay a QR". The QR
 * pay page and the Home checklist both read it (TASK-23054). QR pay is open to
 * every verified user anywhere: the API enables the Manteca pool rails on
 * every ID approval, so a new user with no Manteca rail yet is "verify first",
 * never "no QR".
 */
import { QrKycState } from '@/constants/kyc.consts'
import type { NextAction, RailCapability } from '@/types/capabilities'
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

const gate = (overrides: Partial<Parameters<typeof selectQrKycGate>[0]> = {}) =>
    selectQrKycGate({
        isLoading: false,
        isRegionRestricted: false,
        isTerminalFailure: false,
        canPayManteca: false,
        mantecaRails: [],
        nextActions: [],
        ...overrides,
    }).kycGateState

describe('selectQrKycGate', () => {
    it('loading → LOADING', () => {
        expect(gate({ isLoading: true, canPayManteca: true })).toBe(QrKycState.LOADING)
    })

    it('an enabled pay op → PROCEED_TO_PAY', () => {
        expect(gate({ canPayManteca: true, mantecaRails: [pix()] })).toBe(QrKycState.PROCEED_TO_PAY)
    })

    it('an ID check that ended on a final decision, no enabled rail → PROVIDER_REJECTION_BLOCKED, not "Unlock now"', () => {
        expect(gate({ isTerminalFailure: true })).toBe(QrKycState.PROVIDER_REJECTION_BLOCKED)
        expect(gate({ isTerminalFailure: true, mantecaRails: [pix({ status: 'pending' })] })).toBe(
            QrKycState.PROVIDER_REJECTION_BLOCKED
        )
        expect(qrPayIsAPath(gate({ isTerminalFailure: true }))).toBe(false)
    })

    it('a final decision does not take away a pool rail that already pays', () => {
        expect(gate({ isTerminalFailure: true, canPayManteca: true, mantecaRails: [pix()] })).toBe(
            QrKycState.PROCEED_TO_PAY
        )
    })

    it('a new user with no Manteca rail (any country) → REQUIRES_IDENTITY_VERIFICATION', () => {
        expect(gate()).toBe(QrKycState.REQUIRES_IDENTITY_VERIFICATION)
    })

    it('a pending Manteca rail → IDENTITY_VERIFICATION_IN_PROGRESS', () => {
        expect(gate({ mantecaRails: [pix({ status: 'pending' })] })).toBe(QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS)
    })

    it('a fixable rail → PROVIDER_REJECTION_FIXABLE', () => {
        const rail = pix({ status: 'requires-info', blockingActions: ['sumsub:resubmit'] })
        const nextActions = [{ key: 'sumsub:resubmit', kind: 'sumsub', purpose: 'unlock-manteca', levelKey: 'x' }]
        expect(gate({ mantecaRails: [rail], nextActions: nextActions as never })).toBe(
            QrKycState.PROVIDER_REJECTION_FIXABLE
        )
    })

    // The legacy fallback reads a requires-info rail with a restart action as
    // fixable. The fixable screen opens the document resubmit, which has no
    // rejection to act on for these users (TASK-22698).
    it('a requires-info rail whose fix is the identity restart → PROVIDER_RESTART_IDENTITY', () => {
        const rail = pix({ status: 'requires-info', blockingActions: ['restart-identity'] })
        const nextActions = [{ key: 'restart-identity', kind: 'restart-identity', purpose: 'identity_missing' }]
        expect(gate({ mantecaRails: [rail], nextActions: nextActions as NextAction[] })).toBe(
            QrKycState.PROVIDER_RESTART_IDENTITY
        )
    })

    it('a blocked rail → PROVIDER_REJECTION_BLOCKED', () => {
        expect(gate({ mantecaRails: [pix({ status: 'blocked' })] })).toBe(QrKycState.PROVIDER_REJECTION_BLOCKED)
    })

    it('a region refusal outranks even an enabled pay op → REGION_RESTRICTED', () => {
        expect(gate({ isRegionRestricted: true, canPayManteca: true })).toBe(QrKycState.REGION_RESTRICTED)
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
})

function needsRestartFor(code: string) {
    return qrVerificationNeedsRestart({
        mantecaRails: [pix({ status: 'blocked', reason: { code, userMessage: '' } })],
        nextActions: [],
    })
}

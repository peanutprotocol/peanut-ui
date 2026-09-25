/**
 * The QR-pay KYC gate is the one source for "can this user pay a QR". The QR
 * pay page and the Home checklist both read it (TASK-23054). QR pay is open to
 * every verified user anywhere: the API enables the Manteca pool rails on
 * every ID approval, so a new user with no Manteca rail yet is "verify first",
 * never "no QR".
 */
import { QrKycState } from '@/constants/kyc.consts'
import type { RailCapability } from '@/types/capabilities'
import { qrPayIsAPath, selectQrKycGate } from '../qrKycGate.utils'

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

    it('a blocked rail → PROVIDER_REJECTION_BLOCKED', () => {
        expect(gate({ mantecaRails: [pix({ status: 'blocked' })] })).toBe(QrKycState.PROVIDER_REJECTION_BLOCKED)
    })

    it('a region refusal outranks even an enabled pay op → REGION_RESTRICTED', () => {
        expect(gate({ isRegionRestricted: true, canPayManteca: true })).toBe(QrKycState.REGION_RESTRICTED)
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

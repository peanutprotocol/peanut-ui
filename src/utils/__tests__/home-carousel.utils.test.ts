/** @jest-environment jsdom */
/**
 * The verify slide's rule (Konrad's QR banner rule, TASK-23054), folded into
 * the attention journey state as qr.verifyOpensQr.
 */
import { showVerifyCTA } from '@/utils/home-carousel.utils'
import { QrKycState } from '@/constants/kyc.consts'

describe('showVerifyCTA — the verify slide follows the QR-pay gate', () => {
    const base = { isIdentityVerified: false, isInFlight: false, isCardEligible: false }

    it('shows when verifying opens QR pay', () => {
        expect(showVerifyCTA({ ...base, qrGateState: QrKycState.REQUIRES_IDENTITY_VERIFICATION })).toBe(true)
    })

    it.each([
        QrKycState.REGION_RESTRICTED,
        QrKycState.PROVIDER_REJECTION_BLOCKED,
        QrKycState.PROCEED_TO_PAY,
        QrKycState.LOADING,
    ])('never for %s', (qrGateState) => {
        expect(showVerifyCTA({ ...base, qrGateState })).toBe(false)
    })

    it('never mid-flow, for a verified identity (pool rail or not), or for a card-eligible user', () => {
        const qrGateState = QrKycState.REQUIRES_IDENTITY_VERIFICATION
        expect(showVerifyCTA({ ...base, qrGateState, isInFlight: true })).toBe(false)
        expect(showVerifyCTA({ ...base, qrGateState, isIdentityVerified: true })).toBe(false)
        expect(showVerifyCTA({ ...base, qrGateState, isCardEligible: true })).toBe(false)
    })
})

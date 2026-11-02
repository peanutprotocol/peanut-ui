import { QrKycState } from '@/constants/kyc.consts'
import { deriveQrPayView, type QrPayViewInputs } from '../derive-view'

/** a scanned code ready to pay, which the ladder ends on */
const READY: QrPayViewInputs = {
    kycGateState: QrKycState.PROCEED_TO_PAY,
    isProviderDisabled: false,
    errorInitiatingPayment: null,
    waitingForMerchantAmount: false,
    showOrderNotReadyModal: false,
    isLoadingPaymentData: false,
    rateUnavailable: false,
    loadingState: 'Idle',
    isSuccess: false,
    isManteca: true,
}

describe('deriveQrPayView: the Brazil pause', () => {
    it('shows the paused screen for a Pix code the pause covers', () => {
        expect(deriveQrPayView({ ...READY, isBrazilPaused: true })).toBe('BRAZIL_PAUSED')
    })

    it('comes before the verification screens: a paused user has nothing to verify for', () => {
        expect(
            deriveQrPayView({
                ...READY,
                isBrazilPaused: true,
                kycGateState: QrKycState.REQUIRES_IDENTITY_VERIFICATION,
            })
        ).toBe('BRAZIL_PAUSED')
    })

    it('waits for the user to load first', () => {
        expect(deriveQrPayView({ ...READY, isBrazilPaused: true, kycGateState: QrKycState.LOADING })).toBe(
            'KYC_LOADING'
        )
    })

    it('keeps showing a payment made before the pause started', () => {
        expect(deriveQrPayView({ ...READY, isBrazilPaused: true, hasUnsettledPayment: true })).toBe('STATUS')
        expect(deriveQrPayView({ ...READY, isBrazilPaused: true, isSuccess: true })).toBe('SUCCESS')
    })

    it('changes nothing for a code the pause does not cover', () => {
        expect(deriveQrPayView(READY)).toBe('FORM')
        expect(deriveQrPayView({ ...READY, isProviderDisabled: true })).toBe('MAINTENANCE')
    })
})

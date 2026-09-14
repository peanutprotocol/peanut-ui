import { QrKycState } from '@/constants/kyc.consts'
import type { LoadingStates } from '@/constants/loadingStates.consts'

/**
 * Every screen /qr-pay can show. Exactly one renders at a time; the order of
 * checks in `deriveQrPayView` is the precedence ladder the old page encoded as
 * eleven early returns.
 */
export type QrPayView =
    | 'KYC_LOADING'
    | 'PROVIDER_REJECTION'
    | 'KYC_GATE'
    | 'MAINTENANCE'
    | 'INIT_ERROR'
    | 'AWAITING_MERCHANT'
    | 'ORDER_NOT_READY'
    | 'LOADING'
    | 'STATUS'
    | 'SUCCESS'
    | 'FORM'

export interface QrPayViewInputs {
    kycGateState: QrKycState
    isProviderDisabled: boolean
    errorInitiatingPayment: string | null
    waitingForMerchantAmount: boolean
    showOrderNotReadyModal: boolean
    isLoadingPaymentData: boolean
    loadingState: LoadingStates
    isSuccess: boolean
    isManteca: boolean
    hasUnsettledPayment?: boolean
}

/**
 * The view-precedence ladder, as one pure function. Same trick
 * `classifyScanOutcome` pulled for the scan sub-state, one level up: ordering
 * bugs become unreachable states instead of regressions to re-fix.
 */
export function deriveQrPayView(inputs: QrPayViewInputs): QrPayView {
    if (inputs.kycGateState === QrKycState.LOADING) return 'KYC_LOADING'

    if (
        inputs.kycGateState === QrKycState.PROVIDER_REJECTION_FIXABLE ||
        inputs.kycGateState === QrKycState.PROVIDER_REJECTION_BLOCKED ||
        inputs.kycGateState === QrKycState.PROVIDER_RESTART_IDENTITY
    ) {
        return 'PROVIDER_REJECTION'
    }

    // The KYC gate must come BEFORE the init-error check: unverified users see
    // the verification screen, never an error screen.
    if (
        inputs.kycGateState === QrKycState.REQUIRES_IDENTITY_VERIFICATION ||
        inputs.kycGateState === QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS ||
        inputs.kycGateState === QrKycState.REGION_RESTRICTED
    ) {
        return 'KYC_GATE'
    }

    if (inputs.isProviderDisabled) return 'MAINTENANCE'

    if (inputs.errorInitiatingPayment) return 'INIT_ERROR'

    // Before the loading check: a dynamic QR waiting on the merchant's POS is
    // its own screen, not a generic spinner.
    if (inputs.waitingForMerchantAmount) return 'AWAITING_MERCHANT'

    if (inputs.showOrderNotReadyModal) return 'ORDER_NOT_READY'

    if (inputs.isLoadingPaymentData || inputs.loadingState === 'Paying') return 'LOADING'

    if (inputs.hasUnsettledPayment) return 'STATUS'

    if (inputs.isSuccess && inputs.isManteca) return 'SUCCESS'

    return 'FORM'
}

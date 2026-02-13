import { Button, type ButtonProps } from '@/components/0_Bruddle/Button'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { KycVerificationInProgressModal } from '@/components/Kyc/KycVerificationInProgressModal'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'

interface SumsubKycFlowProps extends ButtonProps {
    onKycSuccess?: () => void
    onManualClose?: () => void
}

/**
 * entry point for the kyc flow
 * renders a button that initiates kyc, the sumsub sdk wrapper modal, and a verification-in-progress modal
 */
export const SumsubKycFlow = ({ onKycSuccess, onManualClose, ...buttonProps }: SumsubKycFlowProps) => {
    const {
        isLoading,
        error,
        showWrapper,
        accessToken,
        handleInitiateKyc,
        handleSdkComplete,
        handleClose,
        refreshToken,
        isVerificationProgressModalOpen,
        closeVerificationProgressModal,
    } = useSumsubKycFlow({ onKycSuccess, onManualClose })

    return (
        <>
            <Button onClick={handleInitiateKyc} disabled={isLoading} {...buttonProps}>
                {isLoading ? 'Loading...' : (buttonProps.children ?? 'Start Verification')}
            </Button>

            {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}

            <SumsubKycWrapper
                visible={showWrapper}
                accessToken={accessToken}
                onClose={handleClose}
                onComplete={handleSdkComplete}
                onRefreshToken={refreshToken}
            />

            <KycVerificationInProgressModal
                isOpen={isVerificationProgressModalOpen}
                onClose={closeVerificationProgressModal}
            />
        </>
    )
}

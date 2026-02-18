import { useState, useCallback } from 'react'
import { Button, type ButtonProps } from '@/components/0_Bruddle/Button'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { KycVerificationInProgressModal } from '@/components/Kyc/KycVerificationInProgressModal'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { useBridgeTosStatus } from '@/hooks/useBridgeTosStatus'
import { useAuth } from '@/context/authContext'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'

interface SumsubKycFlowProps extends ButtonProps {
    onKycSuccess?: () => void
    onManualClose?: () => void
    regionIntent?: KYCRegionIntent
}

/**
 * entry point for the kyc flow.
 * renders a button that initiates kyc, the sumsub sdk wrapper modal,
 * a verification-in-progress modal, and a bridge ToS step after sumsub approval.
 */
export const SumsubKycFlow = ({ onKycSuccess, onManualClose, regionIntent, ...buttonProps }: SumsubKycFlowProps) => {
    const { fetchUser } = useAuth()
    const [showBridgeTos, setShowBridgeTos] = useState(false)
    const { needsBridgeTos } = useBridgeTosStatus()

    // intercept onKycSuccess to check for bridge ToS
    const handleKycApproved = useCallback(async () => {
        // refetch user to get latest rails (submitToProviders may have just run)
        const updatedUser = await fetchUser()
        const rails = updatedUser?.rails ?? []
        const bridgeNeedsTos = rails.some(
            (r) => r.rail.provider.code === 'BRIDGE' && r.status === 'REQUIRES_INFORMATION'
        )

        if (bridgeNeedsTos) {
            setShowBridgeTos(true)
        } else {
            onKycSuccess?.()
        }
    }, [fetchUser, onKycSuccess])

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
    } = useSumsubKycFlow({ onKycSuccess: handleKycApproved, onManualClose, regionIntent })

    const handleTosComplete = useCallback(() => {
        setShowBridgeTos(false)
        onKycSuccess?.()
    }, [onKycSuccess])

    const handleTosSkip = useCallback(() => {
        setShowBridgeTos(false)
        onKycSuccess?.()
    }, [onKycSuccess])

    return (
        <>
            <Button onClick={() => handleInitiateKyc()} disabled={isLoading} {...buttonProps}>
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

            <BridgeTosStep visible={showBridgeTos} onComplete={handleTosComplete} onSkip={handleTosSkip} />
        </>
    )
}

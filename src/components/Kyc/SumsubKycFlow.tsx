import { Button, type ButtonProps } from '@/components/0_Bruddle/Button'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'

interface SumsubKycFlowProps extends ButtonProps {
    onKycSuccess?: () => void
    onManualClose?: () => void
    regionIntent?: KYCRegionIntent
}

/**
 * entry point for the kyc flow.
 * renders a button that initiates kyc, the sumsub sdk wrapper modal,
 * and a multi-phase verification modal that handles:
 *   verifying → preparing → bridge_tos (if applicable) → complete
 */
export const SumsubKycFlow = ({ onKycSuccess, onManualClose, regionIntent, ...buttonProps }: SumsubKycFlowProps) => {
    const flow = useMultiPhaseKycFlow({ onKycSuccess, onManualClose, regionIntent })

    return (
        <>
            <Button onClick={() => flow.handleInitiateKyc()} disabled={flow.isLoading} {...buttonProps}>
                {flow.isLoading ? 'Loading...' : (buttonProps.children ?? 'Start Verification')}
            </Button>

            {flow.error && <p className="text-red-500 mt-2 text-sm">{flow.error}</p>}

            <SumsubKycModals flow={flow} />
        </>
    )
}

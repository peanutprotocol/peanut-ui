import { Button, type ButtonProps } from '@/components/0_Bruddle/Button'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'

interface SumsubKycFlowProps extends ButtonProps {
    onKycSuccess?: () => void
    onManualClose?: () => void
    regionIntent?: KYCRegionIntent
}

// entry point for kyc. delegates to useMultiPhaseKycFlow for the logic;
// SumsubKycModals -> SumsubKycWrapper picks the web or native SDK by platform.
export const SumsubKycFlow = ({ onKycSuccess, onManualClose, regionIntent, ...buttonProps }: SumsubKycFlowProps) => {
    const flow = useMultiPhaseKycFlow({ onKycSuccess, onManualClose, regionIntent })

    return (
        <>
            <Button onClick={() => flow.handleInitiateKyc()} disabled={flow.isLoading} {...buttonProps}>
                {flow.isLoading ? 'Loading...' : (buttonProps.children ?? 'Start Verification')}
            </Button>

            {flow.error && <p className="mt-2 text-body-s">{flow.error}</p>}

            <SumsubKycModals flow={flow} />
        </>
    )
}

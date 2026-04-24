import { Button, type ButtonProps } from '@/components/0_Bruddle/Button'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import { isCapacitor } from '@/utils/capacitor'

interface SumsubKycFlowProps extends ButtonProps {
    onKycSuccess?: () => void
    onManualClose?: () => void
    regionIntent?: KYCRegionIntent
}

// entry point for kyc. delegates to useMultiPhaseKycFlow which handles
// both web (sumsub web sdk) and native (sumsub cordova plugin) paths.
export const SumsubKycFlow = ({ onKycSuccess, onManualClose, regionIntent, ...buttonProps }: SumsubKycFlowProps) => {
    const flow = useMultiPhaseKycFlow({ onKycSuccess, onManualClose, regionIntent })

    return (
        <>
            <Button onClick={() => flow.handleInitiateKyc()} disabled={flow.isLoading} {...buttonProps}>
                {flow.isLoading ? 'Loading...' : (buttonProps.children ?? 'Start Verification')}
            </Button>

            {flow.error && <p className="text-red-500 mt-2 text-sm">{flow.error}</p>}

            {!isCapacitor() && <SumsubKycModals flow={flow} />}
        </>
    )
}

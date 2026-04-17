import { Button, type ButtonProps } from '@/components/0_Bruddle/Button'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import { isCapacitor } from '@/utils/capacitor'
import { BASE_URL } from '@/constants/general.consts'

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
 *
 * in native app (capacitor), the sumsub web sdk doesn't work because
 * CapacitorHttp intercepts its internal requests. instead, open the
 * kyc page in the device's external browser where it works normally.
 */
export const SumsubKycFlow = ({ onKycSuccess, onManualClose, regionIntent, ...buttonProps }: SumsubKycFlowProps) => {
    const flow = useMultiPhaseKycFlow({ onKycSuccess, onManualClose, regionIntent })

    const handleClick = () => {
        if (isCapacitor()) {
            // open kyc in external browser — sumsub sdk doesn't work in capacitor webview
            window.open(`${BASE_URL}/profile/identity-verification`, '_blank')
            return
        }
        flow.handleInitiateKyc()
    }

    return (
        <>
            <Button onClick={handleClick} disabled={flow.isLoading} {...buttonProps}>
                {flow.isLoading ? 'Loading...' : (buttonProps.children ?? 'Start Verification')}
            </Button>

            {flow.error && <p className="text-red-500 mt-2 text-sm">{flow.error}</p>}

            {!isCapacitor() && <SumsubKycModals flow={flow} />}
        </>
    )
}

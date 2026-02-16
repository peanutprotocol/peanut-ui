import { type ButtonProps } from '@/components/0_Bruddle/Button'
import { SumsubKycFlow } from '@/components/Kyc/SumsubKycFlow'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'

interface KycFlowProps extends ButtonProps {
    regionIntent?: KYCRegionIntent
}

// main entry point for the kyc flow.
// renders SumsubKycFlow with an optional region intent for context-aware verification.
export const KycFlow = ({ regionIntent, ...buttonProps }: KycFlowProps) => {
    return <SumsubKycFlow regionIntent={regionIntent} {...buttonProps} />
}

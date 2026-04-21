'use client'

import { useCallback } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { useModalsContext } from '@/context/ModalsContext'
import { useLimits } from '@/hooks/useLimits'
import { useSumsubActionFlow } from '@/hooks/useSumsubActionFlow'
import { initiateIncreaseLimits } from '@/app/actions/increase-limits'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { isBrUserEligibleForLimitIncrease } from '../utils'

const INCREASE_LIMITS_MESSAGE = 'Hi, I would like to increase my payment limits.'

/**
 * Button to increase payment limits.
 * - BR users with ≤1000 USDT monthly limit: self-service document upload
 *   (either auto-uploaded from Sumsub or collected via LATAM KYC SDK)
 * - Everyone else: opens support chat with prefilled message
 */
export default function IncreaseLimitsButton() {
    const { openSupportWithMessage } = useModalsContext()
    const { mantecaLimits, isLoading: isLimitsLoading, refetch } = useLimits()

    const isEligibleForSelfService = isBrUserEligibleForLimitIncrease(mantecaLimits)

    const actionFlow = useSumsubActionFlow({
        fetchToken: initiateIncreaseLimits,
        onSuccess: refetch,
        onNeedsSupport: () => openSupportWithMessage(INCREASE_LIMITS_MESSAGE),
    })

    const handleClick = useCallback(() => {
        if (isEligibleForSelfService) {
            actionFlow.handleInitiate()
        } else {
            openSupportWithMessage(INCREASE_LIMITS_MESSAGE)
        }
    }, [isEligibleForSelfService, actionFlow.handleInitiate, openSupportWithMessage])

    if (actionFlow.isComplete) {
        return (
            <div className="rounded-sm border border-n-1 bg-success-3 p-4 text-center text-sm font-medium">
                Document submitted! Your limits will be updated shortly.
            </div>
        )
    }

    return (
        <>
            <Button
                className="w-full"
                shadowSize="4"
                onClick={handleClick}
                loading={actionFlow.isLoading || isLimitsLoading}
                disabled={actionFlow.isLoading || isLimitsLoading}
            >
                Increase my limits
            </Button>

            {actionFlow.error && <p className="text-center text-xs text-error">{actionFlow.error}</p>}

            <SumsubKycWrapper
                visible={actionFlow.showWrapper}
                accessToken={actionFlow.accessToken}
                onClose={actionFlow.handleClose}
                onComplete={actionFlow.handleSdkComplete}
                onRefreshToken={actionFlow.refreshToken}
                autoStart
                isMultiLevel
            />
        </>
    )
}

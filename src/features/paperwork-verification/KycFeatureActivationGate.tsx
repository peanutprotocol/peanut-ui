'use client'

import type { ReactNode } from 'react'
import type { KycActivationFeature } from '@/app/actions/kyc-feature-activation'
import { useSafeBack } from '@/hooks/useSafeBack'
import Loading from '@/components/Global/Loading'
import { KycFeatureActivationStatus } from './KycFeatureActivationStatus'
import { useKycFeatureActivation } from './useKycFeatureActivation'

export function KycFeatureActivationGate({
    feature,
    children,
}: {
    feature: KycActivationFeature
    children: ReactNode
}) {
    const activation = useKycFeatureActivation(feature)
    const onBack = useSafeBack('/home')
    if (activation.allowed) return <>{children}</>
    if (!activation.result && !activation.isLoading) return <Loading variant="mascot" />
    return (
        <KycFeatureActivationStatus
            feature={feature}
            result={activation.result}
            isLoading={activation.isLoading}
            onRetry={() => void activation.activate()}
            onBack={onBack}
        />
    )
}

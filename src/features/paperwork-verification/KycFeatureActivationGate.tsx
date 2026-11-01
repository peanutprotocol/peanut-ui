'use client'

import type { ReactNode } from 'react'
import type { KycActivationFeature } from '@/app/actions/kyc-feature-activation'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useKycDegraded } from '@/hooks/useKycDegraded'
import { VerificationOutage } from './components/LoadScreens'
import type { ReportScope } from '@/features/kyc-features/report'
import { KycFeatureActivationStatus } from './KycFeatureActivationStatus'
import { useKycFeatureActivation } from './useKycFeatureActivation'

export function KycFeatureActivationGate({
    feature,
    children,
    scope,
}: {
    feature: KycActivationFeature
    children: ReactNode
    scope?: ReportScope
}) {
    const degraded = useKycDegraded()
    const activation = useKycFeatureActivation(feature, { scope, enabled: !degraded })
    const onBack = useSafeBack('/home')
    if (activation.allowed) return <>{children}</>
    if (degraded) return <VerificationOutage onBack={onBack} />
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

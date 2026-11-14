'use client'

import type { ReactNode } from 'react'
import type { KycActivationFeature } from '@/app/actions/kyc-feature-activation'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useKycDegraded } from '@/hooks/useKycDegraded'
import Loading from '@/components/Global/Loading'
import { VerificationOutage } from './components/LoadScreens'
import type { ReportScope } from '@/features/kyc-features/report'
import { CurrencyRefusalScreen } from '@/features/add-money/CurrencyRefusalScreen'
import { KycFeatureActivationStatus } from './KycFeatureActivationStatus'
import { useKycFeatureActivation } from './useKycFeatureActivation'

export function KycFeatureActivationGate({
    feature,
    children,
    scope,
    selectedCurrency,
}: {
    feature: KycActivationFeature
    children: ReactNode
    scope?: ReportScope
    selectedCurrency?: string
}) {
    const degraded = useKycDegraded()
    const activation = useKycFeatureActivation(feature, { scope, enabled: !degraded, selectedCurrency })
    const onBack = useSafeBack('/home')
    if (activation.allowed) return <>{children}</>
    if (degraded) return <VerificationOutage onBack={onBack} />
    if (!activation.userReady) return <Loading variant="mascot" />
    const report = activation.selectedStatus ?? (activation.result?.kind === 'report' ? activation.result.report : null)
    if (selectedCurrency && report?.state === 'refused')
        return (
            <CurrencyRefusalScreen
                currency={selectedCurrency}
                reason={report.reason}
                message={activation.selectedStatus?.message}
                onBack={onBack}
            />
        )
    return (
        <KycFeatureActivationStatus
            feature={feature}
            result={activation.result}
            accountCurrency={selectedCurrency ?? (activation.arsProvisioning ? 'ARS' : undefined)}
            accountStatus={activation.selectedStatus}
            isLoading={activation.isLoading}
            onRetry={() => void activation.activate()}
            onBack={onBack}
        />
    )
}

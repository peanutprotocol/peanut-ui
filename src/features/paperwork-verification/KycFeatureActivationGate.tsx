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
import { useLocalAccountWaitTracking } from './useLocalAccountWaitTracking'

export function KycFeatureActivationGate({
    feature,
    children,
    scope,
    selectedCurrency,
    startOnArrival,
}: {
    /** `pix` opens with no gate in front: the Pix screens open it themselves (`PixAccountOpening`). */
    feature: Exclude<KycActivationFeature, 'pix'>
    children: ReactNode
    scope?: ReportScope
    selectedCurrency?: string
    /** Open the account without the set-up screen: the user picked it on the screen before. */
    startOnArrival?: boolean
}) {
    const degraded = useKycDegraded()
    const activation = useKycFeatureActivation(feature, {
        scope,
        enabled: !degraded,
        selectedCurrency,
        startOnArrival,
    })
    useLocalAccountWaitTracking(activation, selectedCurrency)
    const onBack = useSafeBack('/home')
    if (activation.allowed) return <>{children}</>
    if (degraded) return <VerificationOutage onBack={onBack} />
    if (!activation.userReady) return <Loading variant="mascot" />
    const report = activation.selectedStatus ?? (activation.result?.kind === 'report' ? activation.result.report : null)
    // A bank refusal reads the same with or without a currency picked: the reason, then support.
    if ((selectedCurrency || (feature === 'bank' && activation.selectedStatus)) && report?.state === 'refused')
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
            reverification={activation.reverification}
            accountCurrency={selectedCurrency ?? (activation.arsProvisioning ? 'ARS' : undefined)}
            accountStatus={activation.selectedStatus}
            isLoading={activation.isLoading}
            settling={activation.settling}
            onRetry={() => void activation.activate()}
            onBack={onBack}
        />
    )
}

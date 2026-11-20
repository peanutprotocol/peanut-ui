'use client'

import { Suspense } from 'react'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import { useKycDegraded } from '@/hooks/useKycDegraded'
import { LoadFailed, VerificationOutage } from '@/features/paperwork-verification/components/LoadScreens'
import { ResidenceNotSupportedScreen } from '@/features/paperwork-verification/components/ResidenceNotSupportedScreen'
import { FeatureReverificationFlow } from '@/features/paperwork-verification/FeatureReverificationFlow'
import { useSafeBack } from '@/hooks/useSafeBack'
import { AddFeatureFlow } from '@/features/paperwork-verification/AddFeatureFlow'
import { IdentityRestartFlow } from '@/features/paperwork-verification/IdentityRestartFlow'
import { PaperworkVerificationFlow } from '@/features/paperwork-verification/PaperworkVerificationFlow'
import { VERIFY_RESTART_PARAM } from '@/features/paperwork-verification/paperworkVerificationEntry'
import {
    PaperworkVerificationTrackingProvider,
    type PaperworkVerificationTrackingContext,
} from '@/features/paperwork-verification/analytics'

function VerifyPage() {
    const [feature] = useQueryState('feature', parseAsStringEnum(['bank', 'card', 'local'] as const))
    const [mode] = useQueryState('mode')
    const [returnTo] = useQueryState('returnTo')
    const [targetProvider] = useQueryState(
        'targetProvider',
        parseAsStringEnum(['RAIN', 'BRIDGE', 'MANTECA', 'AVENIA'] as const)
    )
    const [restart] = useQueryState(VERIFY_RESTART_PARAM, parseAsStringEnum(['1'] as const))
    const [reason] = useQueryState('reason', parseAsStringEnum(['residence_not_supported'] as const))
    const exit = useSafeBack('/home')
    const degraded = useKycDegraded()
    if (reason === 'residence_not_supported') return <ResidenceNotSupportedScreen onBack={exit} />
    if (degraded) {
        // The flow the user was opening, as the flow itself would report it.
        const tracking: PaperworkVerificationTrackingContext =
            mode === 'reverify' && feature
                ? { flow: 'paperwork_verification', residence: null, purpose: 'reverify_for_feature', feature }
                : restart
                  ? { flow: 'paperwork_verification', residence: null, restart: true }
                  : feature
                    ? { flow: 'add_later', residence: null, feature }
                    : { flow: 'paperwork_verification', residence: null }
        return (
            <PaperworkVerificationTrackingProvider value={tracking}>
                <VerificationOutage onBack={exit} />
            </PaperworkVerificationTrackingProvider>
        )
    }
    if (mode === 'reverify' && feature)
        return (
            <FeatureReverificationFlow
                feature={feature}
                returnTo={returnTo}
                targetProvider={targetProvider}
                onExit={exit}
            />
        )
    if (mode === 'reverify') return <LoadFailed onRetry={exit} onHome={exit} />
    if (restart) return <IdentityRestartFlow onExit={exit} />
    return feature ? <AddFeatureFlow feature={feature} onExit={exit} /> : <PaperworkVerificationFlow />
}

export default function VerifyRoute() {
    return (
        <Suspense fallback={null}>
            <VerifyPage />
        </Suspense>
    )
}

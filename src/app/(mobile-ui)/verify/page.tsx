'use client'

import { Suspense } from 'react'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import { useKycDegraded } from '@/hooks/useKycDegraded'
import { VerificationOutage } from '@/features/paperwork-verification/components/LoadScreens'
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
    const [restart] = useQueryState(VERIFY_RESTART_PARAM, parseAsStringEnum(['1'] as const))
    const exit = useSafeBack('/home')
    const degraded = useKycDegraded()
    if (degraded) {
        // The flow the user was opening, as the flow itself would report it.
        const tracking: PaperworkVerificationTrackingContext = restart
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

'use client'

import { Suspense } from 'react'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import { useSafeBack } from '@/hooks/useSafeBack'
import { AddFeatureFlow } from '@/features/paperwork-verification/AddFeatureFlow'
import { IdentityRestartFlow } from '@/features/paperwork-verification/IdentityRestartFlow'
import { PaperworkVerificationFlow } from '@/features/paperwork-verification/PaperworkVerificationFlow'
import { VERIFY_RESTART_PARAM } from '@/features/paperwork-verification/paperworkVerificationEntry'

function VerifyPage() {
    const [feature] = useQueryState('feature', parseAsStringEnum(['bank', 'card', 'local'] as const))
    const [restart] = useQueryState(VERIFY_RESTART_PARAM, parseAsStringEnum(['1'] as const))
    const exit = useSafeBack('/home')
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

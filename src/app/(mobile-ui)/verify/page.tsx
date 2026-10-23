'use client'

import { Suspense } from 'react'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import { useSafeBack } from '@/hooks/useSafeBack'
import { AddFeatureFlow } from '@/features/verify-once/AddFeatureFlow'
import { IdentityRestartFlow } from '@/features/verify-once/IdentityRestartFlow'
import { VerifyOnceFlow } from '@/features/verify-once/VerifyOnceFlow'
import { VERIFY_RESTART_PARAM } from '@/features/verify-once/verifyOnceEntry'

function VerifyPage() {
    const [feature] = useQueryState('feature', parseAsStringEnum(['bank', 'card', 'local'] as const))
    const [restart] = useQueryState(VERIFY_RESTART_PARAM, parseAsStringEnum(['1'] as const))
    const exit = useSafeBack('/home')
    if (restart) return <IdentityRestartFlow onExit={exit} />
    return feature ? <AddFeatureFlow feature={feature} onExit={exit} /> : <VerifyOnceFlow />
}

export default function VerifyRoute() {
    return (
        <Suspense fallback={null}>
            <VerifyPage />
        </Suspense>
    )
}

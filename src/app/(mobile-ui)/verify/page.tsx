'use client'

import { Suspense } from 'react'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import { useSafeBack } from '@/hooks/useSafeBack'
import { AddFeatureFlow } from '@/features/verify-once/AddFeatureFlow'
import { VerifyOnceFlow } from '@/features/verify-once/VerifyOnceFlow'

function VerifyPage() {
    const [feature] = useQueryState('feature', parseAsStringEnum(['bank', 'card', 'local'] as const))
    const exit = useSafeBack('/home')
    return feature ? <AddFeatureFlow feature={feature} onExit={exit} /> : <VerifyOnceFlow />
}

export default function VerifyRoute() {
    return (
        <Suspense fallback={null}>
            <VerifyPage />
        </Suspense>
    )
}

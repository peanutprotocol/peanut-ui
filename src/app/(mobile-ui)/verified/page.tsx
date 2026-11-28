'use client'

import { Suspense } from 'react'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import { VerifiedPage } from '@/features/add-money/verified/VerifiedPage'
import { VERIFIED_PAGE_VARIANTS } from '@/features/add-money/verified/verifiedRows'

function VerifiedRoute() {
    const [variant] = useQueryState('variant', parseAsStringEnum([...VERIFIED_PAGE_VARIANTS]).withDefault('verified'))
    return <VerifiedPage variant={variant} />
}

export default function Page() {
    return (
        <Suspense fallback={null}>
            <VerifiedRoute />
        </Suspense>
    )
}

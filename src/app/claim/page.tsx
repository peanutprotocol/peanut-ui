'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'

export default function ClaimPage() {
    const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
    const gaEventTracker = hooks.useAnalyticsEventTracker('claim-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'claim')
    }, [])
    return (
        <global_components.PageWrapper>
            <components.Claim link={pageUrl} />
        </global_components.PageWrapper>
    )
}

'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'

export default function TermsPage() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('terms-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'send')
    }, [])
    return (
        <global_components.PageWrapper>
            <components.Terms />
        </global_components.PageWrapper>
    )
}

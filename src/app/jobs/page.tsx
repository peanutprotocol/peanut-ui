'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'

export default function JobsPage() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('jobs-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'send')
    }, [])
    return (
        <global_components.PageWrapper bgColor="bg-yellow">
            <components.Jobs />
        </global_components.PageWrapper>
    )
}

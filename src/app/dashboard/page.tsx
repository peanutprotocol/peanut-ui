'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'

export default function DashboardPage() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('dashboard-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'dashboard')
    }, [])
    return (
        <global_components.PageWrapper>
            <components.Dashboard />
        </global_components.PageWrapper>
    )
}

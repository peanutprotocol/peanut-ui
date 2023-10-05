'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'

export default function Home() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('landing-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'welcome')
    }, [])

    return (
        <global_components.PageWrapper>
            <components.Welcome />
        </global_components.PageWrapper>
    )
}

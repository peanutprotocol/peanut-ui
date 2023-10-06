'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'

export default function Campains() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('landing-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'campaigns')
    }, [])

    return (
        <global_components.PageWrapper>
            <components.WelcomeBatch />
        </global_components.PageWrapper>
    )
}

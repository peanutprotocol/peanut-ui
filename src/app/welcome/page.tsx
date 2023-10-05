'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'

export default function Welcome() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('welcome-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'Welcome')
    }, [])
    return (
        <global_components.PageWrapper showMarquee={false} bgColor="bg-lightblue">
            <components.Welcome />
        </global_components.PageWrapper>
    )
}

'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'

export default function BlogPage() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('riddle-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'riddle')
    }, [])

    return (
        <global_components.PageWrapper showMarquee={false} bgColor="bg-yellow">
            <components.Riddle />
        </global_components.PageWrapper>
    )
}

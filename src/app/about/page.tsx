'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'
export default function AboutPage() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('about-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'about')
    }, [])
    return (
        <global_components.PageWrapper showMarquee={false} bgColor="bg-lightblue">
            <components.About />
        </global_components.PageWrapper>
    )
}

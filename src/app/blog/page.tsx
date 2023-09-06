'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'

export default function BlogPage() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('blog-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'send')
    }, [])

    return (
        <global_components.PageWrapper showMarquee={false} bgColor="bg-lightblue">
            <components.Blog />
        </global_components.PageWrapper>
    )
}

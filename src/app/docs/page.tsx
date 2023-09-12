'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'

export default function DocsPage() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('docs-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'docs')
    }, [])

    return (
        <global_components.PageWrapper showMarquee={false} bgColor="bg-lightblue">
            <components.Docs />
        </global_components.PageWrapper>
    )
}

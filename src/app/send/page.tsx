'use client'
import { useEffect } from 'react'
import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'

export default function SendPage() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('jobs-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'send')
    }, [])
    return (
        <global_components.PageWrapper>
            <components.Send />
        </global_components.PageWrapper>
    )
}

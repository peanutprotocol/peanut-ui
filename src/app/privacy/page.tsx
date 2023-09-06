'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'

export default function PrivacyPage() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('privacy-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'privacy')
    }, [])
    return (
        <global_components.PageWrapper>
            <components.Privacy />
        </global_components.PageWrapper>
    )
}

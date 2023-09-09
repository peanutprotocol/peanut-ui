'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'

export default function Milkomeda() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('milkomeda-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'milkomeda')
    }, [])
    return (
        <global_components.PageWrapper showMarquee={false} bgColor="bg-lightblue">
            <components.Milkomeda />
        </global_components.PageWrapper>
    )
}

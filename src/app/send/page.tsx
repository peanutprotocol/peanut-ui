'use client'
import { useEffect } from 'react'

import * as hooks from '@/hooks'
import { useRouter } from 'next/navigation'

export default function SendPage() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('jobs-page')
    const router = useRouter()

    useEffect(() => {
        gaEventTracker('peanut-opened', 'send')
        router.push('/')
    }, [])
    return <></>
}

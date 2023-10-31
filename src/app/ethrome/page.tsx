'use client'
import { useEffect } from 'react'
import * as global_components from '@/components/global'
import * as components from '@/components'
import * as hooks from '@/hooks'
import { useRouter } from 'next/navigation'

export default function EthromePage() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('jobs-page')
    const router = useRouter()

    useEffect(() => {
        gaEventTracker('peanut-opened', 'ethrome')
        router.push('https://ethrome.notion.site/ETHRome-Hacker-Manual-e3aa8b443a84426186eede13b0ae8709')
    }, [])
    return <></>
}

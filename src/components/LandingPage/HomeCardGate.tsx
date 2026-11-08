'use client'

import { useEffect, useState } from 'react'
import { LANDING_CARD_FOLD_DISABLED_FLAG } from '@/constants/card-flags.consts'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import type { HomeCardGateProps } from './homeCard.types'

/**
 * The homepage card offer behind its PostHog kill switch. The server always
 * renders the children; the flag is read after mount, because cached flags can
 * resolve before hydration and would make the first client render differ.
 */
export function HomeCardGate({ children }: HomeCardGateProps) {
    const flagEnabled = useFeatureFlags()
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    if (mounted && flagEnabled(LANDING_CARD_FOLD_DISABLED_FLAG)) return null
    return <>{children}</>
}

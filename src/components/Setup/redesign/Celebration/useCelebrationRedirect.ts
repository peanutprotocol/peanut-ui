'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { confettiPresets } from '@/utils/confetti'
import { isDemoMode } from '@/utils/demo'
import { notifyHaptic } from '@/utils/haptics'

/** The app waits this long on the celebration before it leaves. */
export const CELEBRATION_REDIRECT_MS = 4500

/**
 * dev's celebration behaviour (`Views/Success.tsx`): once per mount, also under Strict Mode, a success haptic,
 * `celebration:open` and dev's confetti; after 4.5 s, once, demo mode opens /home and everyone else goes where
 * `handleRedirect` sends a new account (an explicit `redirect_uri`, such as a claim link, first).
 */
export function useCelebrationRedirect(enabled: boolean) {
    const router = useRouter()
    const { handleRedirect } = useAccountSetup()
    const { track } = useSignupControl()
    const redirect = useRef(handleRedirect)
    redirect.current = handleRedirect
    const celebrated = useRef(false)
    const redirecting = useRef(false)

    useEffect(() => {
        if (!enabled || celebrated.current) return
        celebrated.current = true
        notifyHaptic('success')
        track('celebration', 'open')
        confettiPresets.success()
    }, [enabled, track])

    useEffect(() => {
        if (!enabled) return
        const timer = setTimeout(() => {
            if (redirecting.current) return
            redirecting.current = true
            // Demo always opens the walkthrough home, even when sign-up came from a deep link.
            if (isDemoMode()) router.replace('/home')
            else redirect.current({ isNewAccount: true })
        }, CELEBRATION_REDIRECT_MS)
        return () => clearTimeout(timer)
    }, [enabled, router])
}

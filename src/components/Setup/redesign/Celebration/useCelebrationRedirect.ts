'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { shootStarConfetti } from '@/utils/confetti'
import { isDemoMode } from '@/utils/demo'
import { notifyHaptic } from '@/utils/haptics'

/** The app waits this long on the celebration before it leaves. */
export const CELEBRATION_REDIRECT_MS = 4500

/**
 * dev's celebration behaviour (`Views/Success.tsx`): once per mount, also under Strict Mode, a success haptic,
 * `celebration:open` and dev's confetti; after 4.5 s, once, demo mode opens /home and everyone else goes where
 * `handleRedirect` sends a new account (an explicit `redirect_uri`, such as a claim link, first). `hold` stops the
 * wait while the screen asks the person where to go (the verify start). `quiet` (after Confirm later) skips the
 * haptic, event and confetti and leaves at once.
 */
export function useCelebrationRedirect(enabled: boolean, hold = false, quiet = false) {
    const router = useRouter()
    const { handleRedirect } = useAccountSetup()
    const { track } = useSignupControl()
    const redirect = useRef(handleRedirect)
    redirect.current = handleRedirect
    const celebrated = useRef(false)
    const redirecting = useRef(false)

    useEffect(() => {
        if (!enabled || quiet || celebrated.current) return
        celebrated.current = true
        notifyHaptic('success')
        track('celebration', 'open')
        shootStarConfetti()
    }, [enabled, quiet, track])

    useEffect(() => {
        if (!enabled || hold) return
        const timer = setTimeout(
            () => {
                if (redirecting.current) return
                redirecting.current = true
                // Demo always opens the walkthrough home, even when sign-up came from a deep link.
                if (isDemoMode()) router.replace('/home')
                else redirect.current({ isNewAccount: true })
            },
            quiet ? 0 : CELEBRATION_REDIRECT_MS
        )
        return () => clearTimeout(timer)
    }, [enabled, hold, quiet, router])
}

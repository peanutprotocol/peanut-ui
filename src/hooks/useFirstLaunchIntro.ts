'use client'

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { isNativeBridge } from '@/utils/capacitor'
import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'
import { whenNativeSplashHidden } from '@/hooks/useSplashGate'
import { FIRST_LAUNCH_INTRO_KEY, markFirstLaunchIntroSeen } from '@/utils/first-launch-intro'

export { FIRST_LAUNCH_INTRO_KEY } from '@/utils/first-launch-intro'
export const FIRST_LAUNCH_INTRO_DURATION_MS = 5_000
const GREETING_DELAY_MS = 700

type IntroPhase = 'checking' | 'intro' | 'done'

async function hasSeenIntro(): Promise<boolean> {
    if (readStoredValue(FIRST_LAUNCH_INTRO_KEY)) return true
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
        const stored = await Promise.race([
            import('@capacitor/preferences').then(({ Preferences }) =>
                Preferences.get({ key: FIRST_LAUNCH_INTRO_KEY })
            ),
            new Promise<null>((resolve) => {
                timeout = setTimeout(() => resolve(null), 700)
            }),
        ])
        return !!stored?.value
    } catch {
        return false
    } finally {
        clearTimeout(timeout)
    }
}

/** First native landing only; Preferences survives WebView storage eviction and OTA updates. */
export function useFirstLaunchIntro(enabled: boolean, preview?: 'play' | 'still') {
    // Keep SSR and hydration identical; the layout effect resolves local state
    // synchronously before paint when this is a returning visit.
    const [phase, setPhase] = useState<IntroPhase>(enabled ? 'checking' : 'done')
    const [played, setPlayed] = useState(false)
    const [mascotReady, setMascotReady] = useState(false)
    const [splashGone, setSplashGone] = useState(false)
    const [greetingVisible, setGreetingVisible] = useState(false)
    const onMascotReady = useCallback(() => setMascotReady(true), [])

    useLayoutEffect(() => {
        if (!enabled || (!isNativeBridge() && !preview)) {
            setPhase('done')
            return
        }
        if (preview) {
            setPlayed(true)
            setPhase('intro')
            return
        }
        // Returning to Landing must not paint even one frame of the blue intro.
        if (readStoredValue(FIRST_LAUNCH_INTRO_KEY)) {
            setPhase('done')
            return
        }
        let cancelled = false
        void hasSeenIntro().then((seen) => {
            if (cancelled) return
            if (seen) {
                // Restore the synchronous flag after WebView storage eviction.
                writeStoredValue(FIRST_LAUNCH_INTRO_KEY, '1')
                setPhase('done')
                return
            }
            // Claim the presentation before an OTA reload or another landing mount.
            void markFirstLaunchIntroSeen()
            setPlayed(true)
            setPhase('intro')
        })
        return () => {
            cancelled = true
        }
    }, [enabled, preview])

    useEffect(() => {
        if (phase !== 'intro') return
        let cancelled = false
        void (preview ? Promise.resolve() : whenNativeSplashHidden()).then(() => {
            if (!cancelled) setSplashGone(true)
        })
        // A decorative Lottie chunk failure must not strand setup.
        const fallback = setTimeout(onMascotReady, 1_500)
        return () => {
            cancelled = true
            clearTimeout(fallback)
        }
    }, [phase, onMascotReady, preview])

    useEffect(() => {
        if (phase !== 'intro' || !mascotReady || !splashGone) return
        let elapsed = 0
        let startedAt: number | undefined
        let finishTimer: ReturnType<typeof setTimeout> | undefined
        let greetingTimer: ReturnType<typeof setTimeout> | undefined
        const pause = () => {
            clearTimeout(finishTimer)
            clearTimeout(greetingTimer)
            if (startedAt !== undefined) elapsed += performance.now() - startedAt
            startedAt = undefined
        }
        const resume = () => {
            if (document.hidden || startedAt !== undefined) return
            startedAt = performance.now()
            greetingTimer = setTimeout(() => setGreetingVisible(true), Math.max(0, GREETING_DELAY_MS - elapsed))
            if (preview !== 'still') {
                finishTimer = setTimeout(() => setPhase('done'), Math.max(0, FIRST_LAUNCH_INTRO_DURATION_MS - elapsed))
            }
        }
        const onVisibilityChange = () => (document.hidden ? pause() : resume())
        document.addEventListener('visibilitychange', onVisibilityChange)
        resume()
        return () => {
            pause()
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [phase, mascotReady, splashGone, preview])

    return { active: enabled && phase !== 'done', phase, played, greetingVisible, onMascotReady }
}

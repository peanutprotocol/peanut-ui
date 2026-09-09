'use client'

import RainCooldownIntroModal from '@/components/Global/RainCooldown/IntroModal'
import StaleCardApprovalReEnableModal from '@/components/Global/StaleCardApproval/ReEnableModal'
import StaleDeploymentReload from '@/components/Global/StaleDeploymentReload'
import BadgeEarnToast from '@/components/Badges/BadgeEarnToast'
import { AppLockGate } from '@/components/Global/AppLock'
import { PeanutDebug } from '@/context/PeanutDebug'
import { LocaleSync } from '@/i18n/app/LocaleSync'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { whenIdle } from '@/utils/defer-analytics'
import { initSentry } from '@/utils/sentry-init'

/**
 * App-only global surfaces. Split out of `ClientProviders` because these depend
 * on the wallet provider tree — `IntroModal` reads the rain-cooldown context and
 * `PeanutDebug` reaches `useZeroDev` — which the marketing routes do not mount.
 */
export function AppGlobals({ children }: { children: React.ReactNode }) {
    const router = useRouter()

    // App routes want Sentry; the marketing site does not pay for it. Doing it
    // here rather than in sentry.client.config means a client-side navigation
    // off the landing page still initialises the SDK.
    useEffect(() => whenIdle(initSentry), [])

    // Warms the route the app's camera button lands on. Lives here rather than
    // as a <link rel="prefetch"> in the root layout, which spent the bandwidth
    // on marketing visitors who will never reach it.
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') return // 9s+ compile in dev
        router.prefetch('/qr-pay')
    }, [router])

    return (
        <>
            {/* Reads useAuth and useAppLocale, so it can only mount where both
                exist — the marketing routes have neither. */}
            <LocaleSync />
            <PeanutDebug />
            {/* Mounted here (not in a route-group layout) so the cooldown
                explainer also covers public pay/send/request pages —
                the rain:cooldown event fires on every spend path. */}
            <RainCooldownIntroModal />
            {/* Global recovery prompt: a withdraw refused with 409
                STALE_CARD_APPROVAL (stale session-key approval) fires
                RAIN_STALE_APPROVAL_EVENT — mount here so the re-enable
                CTA covers every spend path, not just the card screen. */}
            <StaleCardApprovalReEnableModal />
            {/* Non-intrusive "badge unlocked" toast on /home (TASK-19791).
                Global so it surfaces wherever the user lands after earning. */}
            <BadgeEarnToast />
            {/* Mounted inside the providers (not called in ClientProviders'
                component body like OtaUpdateProvider) because it reads the query
                client, redux and loading-state context to know when a reload
                is safe. */}
            <StaleDeploymentReload />
            {/* Wraps rather than sits beside the page: while the native app is
                locked, nothing protected renders. */}
            <AppLockGate>{children}</AppLockGate>
        </>
    )
}

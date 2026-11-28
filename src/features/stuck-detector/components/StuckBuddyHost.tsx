'use client'

import { AnimatePresence } from 'framer-motion'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryStates } from 'nuqs'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/nextjs'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { BASE_URL } from '@/constants/general.consts'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useAuth } from '@/context/authContext'
import { useModalsContextOptional } from '@/context/ModalsContext'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { useWallet } from '@/hooks/wallet/useWallet'
import { isAndroidNative, isIOSNative } from '@/utils/capacitor'
import { isManagerOverlayOpen, useAnyOverlayOpen } from '@/utils/overlay-visibility'
import { decideStuckIntervention } from '../decideIntervention'
import {
    createDefaultStuckMemory,
    markSeenAddMoneyUnfunded,
    readStuckMemory,
    recordSessionOutcome,
    recordSurfaceDismissal,
} from '../memory'
import {
    canonicalStuckRoute,
    isBankDepositPath,
    isStuckExcludedPath,
    journeyForPath,
    parseDemoSurface,
    surfaceForPath,
} from '../routeJourney'
import { scoreStuckSession, STUCK_MODEL } from '../scoreModel'
import {
    evaluateIdleTick,
    getStuckRuntimeSnapshot,
    markSessionNudgeShown,
    markShadowLogged,
    notePointerTap,
    setStuckRoute,
    subscribeStuckRuntime,
} from '../signalStore'
import type { BugReportCategory, StuckSurface } from '../types'
import { ActiveIssueDrawer } from './ActiveIssueDrawer'
import { AddMoneyHelpDrawer } from './AddMoneyHelpDrawer'
import { HomeFundedDrawer } from './HomeFundedDrawer'
import { PeanutBuddy } from './PeanutBuddy'

const IDLE_POLL_MS = 5_000
const IS_PROD_DOMAIN = BASE_URL === 'https://peanut.me'

const BUDDY_PROMPT_KEYS: Record<StuckSurface, { prompt: string; cta: string }> = {
    add_money: { prompt: 'prompts.addMoney', cta: 'ctas.addMoney' },
    verify_loop: { prompt: 'prompts.verifyLoop', cta: 'ctas.contactSupport' },
    setup_passkey: { prompt: 'prompts.setupPasskey', cta: 'ctas.contactSupport' },
    home_funded: { prompt: 'prompts.homeFunded', cta: 'ctas.homeFunded' },
    active_issue: { prompt: 'prompts.activeIssue', cta: 'ctas.activeIssue' },
}

const DIRECT_SUPPORT_SURFACES = new Set<StuckSurface>(['verify_loop', 'setup_passkey'])

interface StuckBuddyCoreProps {
    variant: 'app' | 'setup'
    balanceUsd: number | null
    hasSpent: boolean
}

function resolvePlatform(): 'ios-native' | 'android-native' | 'web' {
    if (isIOSNative()) return 'ios-native'
    if (isAndroidNative()) return 'android-native'
    return 'web'
}

function StuckBuddyCore({ variant, balanceUsd, hasSpent }: StuckBuddyCoreProps) {
    const pathname = usePathname() || ''
    const [urlParams] = useQueryStates({
        country: parseAsString,
        view: parseAsString,
        stuck_demo: parseAsString,
    })
    const effectiveRoute = useMemo(
        () => canonicalStuckRoute(pathname, urlParams.country, urlParams.view),
        [pathname, urlParams.country, urlParams.view]
    )
    const router = useRouter()
    const t = useTranslations('stuckBuddy')
    const { user } = useAuth()
    const userId = user?.user?.userId ?? null
    const modals = useModalsContextOptional()
    const isFlagEnabled = useFeatureFlags()
    const anyUserOverlayOpen = useAnyOverlayOpen()
    const { keyboardInset } = useVisualViewport(true)

    const runtime = useSyncExternalStore(subscribeStuckRuntime, getStuckRuntimeSnapshot, getStuckRuntimeSnapshot)
    const analyticsOptedOut = typeof posthog.has_opted_out_capturing === 'function' && posthog.has_opted_out_capturing()
    const [memory, setMemory] = useState(() =>
        analyticsOptedOut ? createDefaultStuckMemory() : readStuckMemory(userId)
    )
    const [drawerSurface, setDrawerSurface] = useState<StuckSurface | null>(null)
    const [dismissedThisVisit, setDismissedThisVisit] = useState(false)
    const [nowMs, setNowMs] = useState(() => Date.now())
    const smoothedRef = useRef(0)
    const sessionOutcomeSavedRef = useRef(false)

    // Refresh per-user localStorage memory when auth or opt-out state settles.
    useEffect(() => {
        setMemory(analyticsOptedOut ? createDefaultStuckMemory() : readStuckMemory(userId))
    }, [userId, analyticsOptedOut])

    // Sync canonical route (including Capacitor ?country=...&view=bank|manteca) into signal store.
    useEffect(() => {
        setStuckRoute(effectiveRoute)
        setDismissedThisVisit(false)
        if (!analyticsOptedOut && isBankDepositPath(effectiveRoute) && (balanceUsd ?? 0) <= 0) {
            setMemory(markSeenAddMoneyUnfunded(userId))
        }
    }, [effectiveRoute, userId, balanceUsd, analyticsOptedOut])

    // Lightweight global tap listener for rage-tap detection (honors `data-stuck-ignore`).
    useEffect(() => {
        if (typeof window === 'undefined' || isStuckExcludedPath(effectiveRoute)) return
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as HTMLElement | null
            const ignored = Boolean(target?.closest?.('[data-stuck-ignore="true"], [data-mood-ignore]'))
            notePointerTap(event.clientX, event.clientY, ignored)
        }
        window.addEventListener('pointerdown', onPointerDown, { passive: true })
        return () => window.removeEventListener('pointerdown', onPointerDown)
    }, [effectiveRoute])

    // Periodic idle & dwell tick (5s cadence — negligible CPU).
    useEffect(() => {
        if (isStuckExcludedPath(effectiveRoute)) return
        const interval = window.setInterval(() => {
            const now = Date.now()
            evaluateIdleTick(now)
            setNowMs(now)
        }, IDLE_POLL_MS)
        return () => window.clearInterval(interval)
    }, [effectiveRoute])

    const demoSurface = useMemo(
        () =>
            parseDemoSurface(
                urlParams.stuck_demo ? `?stuck_demo=${encodeURIComponent(urlParams.stuck_demo)}` : '',
                !IS_PROD_DOMAIN
            ),
        [urlParams.stuck_demo]
    )

    const surface = useMemo(() => surfaceForPath(effectiveRoute, hasSpent), [effectiveRoute, hasSpent])
    const journey = useMemo(() => journeyForPath(effectiveRoute), [effectiveRoute])

    const scoreResult = useMemo(() => {
        const durationSeconds = Math.max(0, (nowMs - runtime.sessionStartedAt) / 1000)
        const result = scoreStuckSession(
            {
                flags: runtime.flags,
                durationSeconds,
                loggedIn: Boolean(userId),
                journey,
                platform: resolvePlatform(),
                memory,
            },
            smoothedRef.current
        )
        smoothedRef.current = result.smoothedScore
        return result
    }, [nowMs, runtime.sessionStartedAt, runtime.flags, userId, journey, memory])

    // Shadow-mode telemetry: log once per session when the trained GBDT crosses 0.60,
    // even while the UI rollout flag is OFF so we validate live precision before flipping 50/50.
    useEffect(() => {
        if (runtime.shadowLoggedForSession || isStuckExcludedPath(effectiveRoute)) return
        const peak = Math.max(scoreResult.rawScore, scoreResult.smoothedScore)
        if (peak < STUCK_MODEL.defaultThreshold) return
        markShadowLogged()
        posthog.capture(ANALYTICS_EVENTS.STUCK_SCORE_SHADOW, {
            model_version: scoreResult.modelVersion,
            raw_score: Number(scoreResult.rawScore.toFixed(4)),
            smoothed_score: Number(scoreResult.smoothedScore.toFixed(4)),
            journey,
            surface: surface ?? 'none',
            ui_flag_enabled: isFlagEnabled('stuck-buddy-interventions'),
            has_app_error: runtime.flags.appError,
            has_money_failed: runtime.flags.moneyFailed,
            has_kyc_blocked: runtime.flags.kycBlocked,
            has_rage_taps: runtime.flags.rageTaps,
            has_long_idle: runtime.flags.longIdle,
        })
        if (!analyticsOptedOut && !sessionOutcomeSavedRef.current) {
            sessionOutcomeSavedRef.current = true
            setMemory(
                recordSessionOutcome(userId, {
                    hadFriction:
                        runtime.flags.appError ||
                        runtime.flags.moneyFailed ||
                        runtime.flags.kycBlocked ||
                        runtime.flags.rageTaps,
                    wasStuck: true,
                })
            )
        }
    }, [
        runtime.shadowLoggedForSession,
        runtime.flags,
        effectiveRoute,
        scoreResult,
        journey,
        surface,
        isFlagEnabled,
        userId,
        analyticsOptedOut,
    ])

    const uiEnabled = Boolean(demoSurface) || isFlagEnabled('stuck-buddy-interventions')

    const decision = useMemo(() => {
        if (!uiEnabled || dismissedThisVisit) {
            return { show: false as const, suppressedBy: 'below_threshold' as const }
        }
        return decideStuckIntervention({
            pathname: effectiveRoute,
            surface,
            rawScore: scoreResult.rawScore,
            smoothedScore: scoreResult.smoothedScore,
            elapsedOnScreenMs: Math.max(0, nowMs - runtime.screenEnteredAt),
            flags: runtime.flags,
            memory,
            nowMs,
            sessionNudgeShown: runtime.sessionNudgeShown,
            hasOverlayOpen: anyUserOverlayOpen || isManagerOverlayOpen() || drawerSurface !== null,
            isKeyboardOpen: keyboardInset > 0,
            isFlowBusy: runtime.isFlowBusy,
            passkeyStepState: runtime.passkeyStepState,
            localVerifyAttempts: runtime.localVerifyAttempts,
            passkeyCancelCount: runtime.passkeyCancelCount,
            corridorSwitchCount: runtime.corridorSwitchCount,
            errorRetryCount: runtime.errorRetryCount,
            balanceUsd,
            hasSpent,
            demoSurface,
        })
    }, [
        uiEnabled,
        dismissedThisVisit,
        effectiveRoute,
        surface,
        scoreResult.rawScore,
        scoreResult.smoothedScore,
        nowMs,
        runtime,
        memory,
        anyUserOverlayOpen,
        drawerSurface,
        keyboardInset,
        balanceUsd,
        hasSpent,
        demoSurface,
    ])

    const shownLoggedRef = useRef<string | null>(null)
    useEffect(() => {
        if (!decision.show) return
        const key = `${decision.surface}:${decision.reason}`
        if (shownLoggedRef.current === key) return
        shownLoggedRef.current = key
        posthog.capture(ANALYTICS_EVENTS.STUCK_BUDDY_SHOWN, {
            surface: decision.surface,
            pose: decision.pose,
            reason: decision.reason,
            is_demo: decision.isDemo,
            raw_score: Number(scoreResult.rawScore.toFixed(4)),
            model_version: scoreResult.modelVersion,
        })
    }, [decision, scoreResult.rawScore, scoreResult.modelVersion])

    const handleContactSupport = useCallback(
        (topic: string, copyContext?: string) => {
            if (copyContext && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                void navigator.clipboard.writeText(copyContext).catch(() => {})
            }
            posthog.capture(ANALYTICS_EVENTS.STUCK_BUDDY_ACTION, {
                surface: decision.show ? decision.surface : (drawerSurface ?? 'unknown'),
                action: 'contact_support',
                copied_context: Boolean(copyContext),
            })
            if (modals) {
                modals.openSupportWithMessage(topic)
            }
        },
        [decision, drawerSurface, modals]
    )

    const handleBuddyAction = useCallback(() => {
        if (!decision.show) return
        if (!decision.isDemo) markSessionNudgeShown()
        setDismissedThisVisit(true)
        posthog.capture(ANALYTICS_EVENTS.STUCK_BUDDY_ACTION, {
            surface: decision.surface,
            action: 'open_helper',
            reason: decision.reason,
        })
        if (DIRECT_SUPPORT_SURFACES.has(decision.surface)) {
            const topicKey =
                decision.surface === 'verify_loop' ? 'supportTopics.verifyLoop' : 'supportTopics.setupPasskey'
            handleContactSupport(t(topicKey))
            return
        }
        setDrawerSurface(decision.surface)
    }, [decision, handleContactSupport, t])

    const handleDismiss = useCallback(() => {
        if (!decision.show) return
        setDismissedThisVisit(true)
        if (!decision.isDemo) {
            markSessionNudgeShown()
            if (!analyticsOptedOut) {
                setMemory(recordSurfaceDismissal(userId, decision.surface))
            }
        }
        posthog.capture(ANALYTICS_EVENTS.STUCK_BUDDY_DISMISSED, {
            surface: decision.surface,
            reason: decision.reason,
            raw_score: Number(scoreResult.rawScore.toFixed(4)),
        })
    }, [decision, userId, analyticsOptedOut, scoreResult.rawScore])

    const handleSubmitBugReport = useCallback(
        (category: BugReportCategory, note: string) => {
            const replayUrl =
                !analyticsOptedOut && typeof posthog.get_session_replay_url === 'function'
                    ? posthog.get_session_replay_url()
                    : undefined
            posthog.capture(ANALYTICS_EVENTS.STUCK_BUG_REPORT_SUBMITTED, {
                category,
                has_note: Boolean(note),
                route: effectiveRoute,
                error_code: runtime.lastErrorCode,
                raw_score: Number(scoreResult.rawScore.toFixed(4)),
                model_version: scoreResult.modelVersion,
                replay_url: replayUrl ?? null,
            })
            // Explicit user-initiated bug report submission; omit session replay and telemetry score when opted out.
            Sentry.captureMessage(`stuck-buddy bug report: ${category}`, {
                level: 'info',
                tags: {
                    feature: 'stuck-detector',
                    category,
                    route: effectiveRoute,
                },
                extra: analyticsOptedOut
                    ? {
                          note: note || undefined,
                          lastErrorCode: runtime.lastErrorCode,
                      }
                    : {
                          note: note || undefined,
                          lastErrorCode: runtime.lastErrorCode,
                          replayUrl,
                          rawScore: Number(scoreResult.rawScore.toFixed(4)),
                      },
            })
        },
        [analyticsOptedOut, effectiveRoute, runtime.lastErrorCode, scoreResult.rawScore, scoreResult.modelVersion]
    )

    const clearance =
        variant === 'setup'
            ? 'setup-footer'
            : effectiveRoute.startsWith('/add-money') || effectiveRoute.startsWith('/verify')
              ? 'footer'
              : 'bottom-nav'

    return (
        <>
            <AnimatePresence>
                {decision.show && (
                    <PeanutBuddy
                        key={`${decision.surface}-${decision.pose}`}
                        pose={decision.pose}
                        prompt={t(BUDDY_PROMPT_KEYS[decision.surface].prompt as Parameters<typeof t>[0])}
                        ctaLabel={t(BUDDY_PROMPT_KEYS[decision.surface].cta as Parameters<typeof t>[0])}
                        dismissLabel={t('a11y.dismiss')}
                        mascotLabel={t('a11y.openHelper')}
                        clearance={clearance}
                        onAction={handleBuddyAction}
                        onDismiss={handleDismiss}
                    />
                )}
            </AnimatePresence>

            <AddMoneyHelpDrawer
                open={drawerSurface === 'add_money'}
                onClose={() => setDrawerSurface(null)}
                onContactSupport={handleContactSupport}
            />
            <HomeFundedDrawer
                open={drawerSurface === 'home_funded'}
                onClose={() => setDrawerSurface(null)}
                onNavigate={(href) => router.push(href)}
                onContactSupport={handleContactSupport}
            />
            <ActiveIssueDrawer
                open={drawerSurface === 'active_issue'}
                onClose={() => setDrawerSurface(null)}
                onContactSupport={handleContactSupport}
                onSubmitBugReport={handleSubmitBugReport}
            />
        </>
    )
}

/** Mounted inside `(mobile-ui)/MobileLayoutClient.tsx` for authenticated in-app flows. */
export function StuckBuddyHost() {
    const { user } = useAuth()
    const { balance } = useWallet()
    const balanceUsd = balance !== undefined ? Number(balance) / 10 ** PEANUT_WALLET_TOKEN_DECIMALS : null
    const hasSpent = Boolean(user?.user?.isActivated)
    return <StuckBuddyCore variant="app" balanceUsd={balanceUsd} hasSpent={hasSpent} />
}

/** Mounted inside `(setup)/layout.tsx` for unauthenticated setup flows (no wallet queries). */
export function SetupStuckBuddyHost() {
    return <StuckBuddyCore variant="setup" balanceUsd={null} hasSpent={false} />
}

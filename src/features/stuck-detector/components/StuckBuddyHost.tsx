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
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { useWallet } from '@/hooks/wallet/useWallet'
import { getPlatform } from '@/utils/capacitor'
import { useAnyAppOverlayOpen } from '@/utils/overlay-visibility'
import { redactSupportText } from '@/utils/support-context'
import { decideStuckIntervention } from '../decideIntervention'
import { readStuckMemory, recordSurfaceActionCooldown, recordSurfaceDismissal } from '../memory'
import {
    canonicalStuckRoute,
    isStuckExcludedPath,
    journeyForPath,
    parseDemoSurface,
    surfaceForPath,
} from '../routeJourney'
import {
    clearActiveImpression,
    evaluateIdleTick,
    getStuckRuntimeSnapshot,
    markSeenDepositDetailsUnfundedInSession,
    markSessionNudgeShown,
    markSessionWhimsyShown,
    noteElementClick,
    noteUserActivity,
    setStuckDocumentVisible,
    setStuckRoute,
    subscribeStuckRuntime,
} from '../signalStore'
import type { BugReportCategory, StuckSurface } from '../types'
import { useKeyboardOpen } from '../useKeyboardOpen'
import { ActiveIssueDrawer } from './ActiveIssueDrawer'
import { AddMoneyHelpDrawer } from './AddMoneyHelpDrawer'
import { HomeFundedDrawer } from './HomeFundedDrawer'
import { PeanutBuddy } from './PeanutBuddy'

const IDLE_POLL_MS = 5_000
const MIN_UNFUNDED_EXIT_DWELL_MS = 10_000
const CHECKPOINT_SECONDS = [0, 15, 30, 60] as const
const IS_PROD_DOMAIN = BASE_URL === 'https://peanut.me'
const DIRECT_SUPPORT_SURFACES = new Set<StuckSurface>(['verify_loop', 'setup_passkey'])

interface StuckBuddyCoreProps {
    variant: 'app' | 'setup'
    balanceUsd: number | null
    hasSpent: boolean
    canUseQrPay: boolean
    canUseCard: boolean
}

function StuckBuddyCore({ variant, balanceUsd, hasSpent, canUseQrPay, canUseCard }: StuckBuddyCoreProps) {
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
    const anyOverlayOpen = useAnyAppOverlayOpen()

    const runtime = useSyncExternalStore(subscribeStuckRuntime, getStuckRuntimeSnapshot, getStuckRuntimeSnapshot)
    const analyticsOptedOut = typeof posthog.has_opted_out_capturing === 'function' && posthog.has_opted_out_capturing()

    // Functional dismissal preferences are always read regardless of analytics consent (never re-nag opted-out users).
    const [memory, setMemory] = useState(() => readStuckMemory(userId))
    const [drawerSurface, setDrawerSurface] = useState<StuckSurface | null>(null)
    const [dismissedThisVisit, setDismissedThisVisit] = useState(false)
    const [nowMs, setNowMs] = useState(() => Date.now())

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
    const uiEnabled = Boolean(demoSurface) || isFlagEnabled('stuck-buddy-interventions')

    // Run keyboard guard identically in BOTH control and treatment arms so holdout eligibility is apples-to-apples.
    const isKeyboardOpen = useKeyboardOpen(Boolean(surface || demoSurface))

    useEffect(() => {
        setMemory(readStuckMemory(userId))
    }, [userId])

    useEffect(() => {
        setStuckRoute(effectiveRoute)
        setDismissedThisVisit(false)
    }, [effectiveRoute])

    // Record `seenDepositDetailsUnfundedInSession` in memory (no localStorage write) when leaving a bank-details step
    // after >=10s dwell with verified $0 balance so both control and treatment arms compute identical eligibility.
    const balanceUsdRef = useRef(balanceUsd)
    balanceUsdRef.current = balanceUsd
    const activeDwellRef = useRef(runtime.activeDwellMs)
    activeDwellRef.current = runtime.activeDwellMs
    useEffect(() => {
        if (!runtime.isDepositDetailsStep) return
        return () => {
            if (
                balanceUsdRef.current !== null &&
                balanceUsdRef.current <= 0 &&
                activeDwellRef.current >= MIN_UNFUNDED_EXIT_DWELL_MS
            ) {
                markSeenDepositDetailsUnfundedInSession()
            }
        }
    }, [runtime.isDepositDetailsStep])

    // Visibility-aware dwell/idle clocks + activity (incl. capture-phase scroll inside `#scrollable-content` and touchmove)
    // + same-element rage-click listener.
    useEffect(() => {
        if (typeof window === 'undefined' || isStuckExcludedPath(effectiveRoute)) return
        setStuckDocumentVisible(document.visibilityState === 'visible')

        const onVisibility = () => setStuckDocumentVisible(document.visibilityState === 'visible')
        const onClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null
            const ignored = Boolean(target?.closest?.('[data-stuck-ignore="true"]'))
            noteElementClick(event.target, event.clientX, event.clientY, ignored)
        }
        const onActivity = () => noteUserActivity()

        document.addEventListener('visibilitychange', onVisibility)
        // `scroll` does not bubble, so capture phase is required to catch `#scrollable-content` scrolling.
        document.addEventListener('scroll', onActivity, { capture: true, passive: true })
        window.addEventListener('click', onClick, { passive: true })
        window.addEventListener('keydown', onActivity, { passive: true })
        window.addEventListener('input', onActivity, { passive: true })
        window.addEventListener('touchmove', onActivity, { passive: true })

        return () => {
            document.removeEventListener('visibilitychange', onVisibility)
            document.removeEventListener('scroll', onActivity, { capture: true })
            window.removeEventListener('click', onClick)
            window.removeEventListener('keydown', onActivity)
            window.removeEventListener('input', onActivity)
            window.removeEventListener('touchmove', onActivity)
        }
    }, [effectiveRoute])

    // Periodic visible dwell & idle tick (5s cadence; skipped on excluded routes).
    useEffect(() => {
        if (isStuckExcludedPath(effectiveRoute) || (!surface && !demoSurface)) return
        const interval = window.setInterval(() => {
            const now = Date.now()
            evaluateIdleTick(now)
            setNowMs(now)
        }, IDLE_POLL_MS)
        return () => window.clearInterval(interval)
    }, [effectiveRoute, surface, demoSurface])

    // Leak-free browser-feature checkpoint logging (entry, 15s, 30s, 60s of active visible dwell)
    // so any future mid-session model trains strictly on real browser-observable features.
    const loggedCheckpointsRef = useRef<Set<string>>(new Set())
    useEffect(() => {
        if (isStuckExcludedPath(effectiveRoute) || !surface || analyticsOptedOut) return
        const dwellSeconds = runtime.activeDwellMs / 1000
        for (const cp of CHECKPOINT_SECONDS) {
            if (dwellSeconds < cp) continue
            const key = `${effectiveRoute}:${cp}`
            if (loggedCheckpointsRef.current.has(key)) continue
            loggedCheckpointsRef.current.add(key)
            posthog.capture(ANALYTICS_EVENTS.STUCK_SIGNAL_CHECKPOINT, {
                checkpoint_s: cp,
                journey,
                surface,
                platform: getPlatform(),
                logged_in: Boolean(userId),
                is_deposit_details_step: runtime.isDepositDetailsStep,
                active_dwell_ms: Math.round(runtime.activeDwellMs),
                active_idle_ms: Math.round(runtime.activeIdleMs),
                has_app_error: runtime.flags.appError,
                has_money_failed: runtime.flags.moneyFailed,
                has_kyc_blocked: runtime.flags.kycBlocked,
                has_rage_taps: runtime.flags.rageTaps,
                local_verify_attempts: runtime.localVerifyAttempts,
                passkey_cancel_count: runtime.passkeyCancelCount,
                corridor_switch_count: runtime.corridorSwitchCount,
                error_retry_count: runtime.errorRetryCount,
            })
        }
    }, [effectiveRoute, surface, journey, analyticsOptedOut, userId, runtime])

    const activeImpressionMatchesCurrentRoute =
        runtime.activeImpressionKey !== null && runtime.activeImpressionKey.startsWith(`${effectiveRoute}:`)
    const activeImpressionIsWhimsy = runtime.activeImpressionKey === `${effectiveRoute}:home_wave`

    const decision = useMemo(
        () =>
            decideStuckIntervention({
                surface,
                uiEnabled,
                isProdDomain: IS_PROD_DOMAIN,
                dismissedThisVisit,
                isDepositDetailsStep: runtime.isDepositDetailsStep,
                activeDwellMs: runtime.activeDwellMs,
                activeDwellSincePasskeyCancelMs: runtime.activeDwellSincePasskeyCancelMs,
                activeIdleMs: runtime.activeIdleMs,
                flags: runtime.flags,
                hadSessionFriction: runtime.hadSessionFriction,
                seenDepositDetailsUnfundedInSession: runtime.seenDepositDetailsUnfundedInSession,
                memory,
                nowMs,
                // Once an impression lands, keep THAT buddy mounted for this visit, while blocking any second buddy on later routes.
                sessionNudgeShown:
                    runtime.sessionNudgeShown && !(activeImpressionMatchesCurrentRoute && !activeImpressionIsWhimsy),
                sessionWhimsyShown: runtime.sessionWhimsyShown && !activeImpressionIsWhimsy,
                hasOverlayOpen: anyOverlayOpen || drawerSurface !== null,
                isKeyboardOpen,
                isFlowBusy: runtime.isFlowBusy,
                passkeyStepState: runtime.passkeyStepState,
                localVerifyAttempts: runtime.localVerifyAttempts,
                passkeyCancelCount: runtime.passkeyCancelCount,
                corridorSwitchCount: runtime.corridorSwitchCount,
                errorRetryCount: runtime.errorRetryCount,
                balanceUsd,
                hasSpent,
                demoSurface,
            }),
        [
            surface,
            uiEnabled,
            dismissedThisVisit,
            runtime,
            memory,
            nowMs,
            activeImpressionMatchesCurrentRoute,
            activeImpressionIsWhimsy,
            anyOverlayOpen,
            drawerSurface,
            isKeyboardOpen,
            balanceUsd,
            hasSpent,
            demoSurface,
        ]
    )

    // Holdout comparability: log `stuck_buddy_eligible` identically in BOTH treatment and control arms,
    // applying the same once-per-session virtual cap in control so neither arm double-counts a session.
    const eligibleLoggedRef = useRef<string | null>(null)
    useEffect(() => {
        const eligibleMatch =
            decision.show && decision.eligible
                ? { surface: decision.surface, mode: decision.mode, reason: decision.reason, arm: 'treatment' as const }
                : !decision.show && decision.eligibleInControl
                  ? { ...decision.eligibleInControl, arm: 'control' as const }
                  : null
        if (!eligibleMatch) return
        const key = `${effectiveRoute}:${eligibleMatch.surface}:${eligibleMatch.reason}:${eligibleMatch.arm}`
        if (eligibleLoggedRef.current === key) return
        eligibleLoggedRef.current = key
        if (eligibleMatch.arm === 'control') {
            if (eligibleMatch.mode === 'whimsy') {
                markSessionWhimsyShown()
            } else {
                markSessionNudgeShown()
            }
        }
        posthog.capture(ANALYTICS_EVENTS.STUCK_BUDDY_ELIGIBLE, {
            surface: eligibleMatch.surface,
            mode: eligibleMatch.mode,
            reason: eligibleMatch.reason,
            arm: eligibleMatch.arm,
            journey,
        })
    }, [decision, effectiveRoute, journey])

    const shownLoggedRef = useRef<string | null>(null)
    const whimsyLandedRef = useRef(false)
    const handleImpression = useCallback(() => {
        if (!decision.show) return
        if (!decision.isDemo) {
            if (decision.mode === 'whimsy') {
                whimsyLandedRef.current = true
                markSessionWhimsyShown(`${effectiveRoute}:home_wave`)
            } else {
                markSessionNudgeShown(`${effectiveRoute}:${decision.surface}`)
            }
        }
        const key = `${effectiveRoute}:${decision.surface}:${decision.reason}`
        if (shownLoggedRef.current === key) return
        shownLoggedRef.current = key
        posthog.capture(ANALYTICS_EVENTS.STUCK_BUDDY_SHOWN, {
            surface: decision.surface,
            pose: decision.pose,
            mode: decision.mode,
            reason: decision.reason,
            is_demo: decision.isDemo,
        })
    }, [decision, effectiveRoute])

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
        setDismissedThisVisit(true)
        if (!decision.isDemo) {
            if (decision.mode === 'whimsy') {
                markSessionWhimsyShown()
            } else {
                markSessionNudgeShown()
            }
            clearActiveImpression()
            setMemory(recordSurfaceActionCooldown(userId, decision.surface))
        }
        posthog.capture(ANALYTICS_EVENTS.STUCK_BUDDY_ACTION, {
            surface: decision.surface,
            action: 'open_helper',
            reason: decision.reason,
        })
        if (DIRECT_SUPPORT_SURFACES.has(decision.surface)) {
            const topic =
                decision.surface === 'verify_loop' ? t('supportTopics.verifyLoop') : t('supportTopics.setupPasskey')
            handleContactSupport(topic)
            return
        }
        if (decision.surface === 'home_wave') {
            setDrawerSurface(balanceUsd !== null && balanceUsd >= 10 && !hasSpent ? 'home_funded' : 'active_issue')
            return
        }
        setDrawerSurface(decision.surface)
    }, [decision, userId, handleContactSupport, t, balanceUsd, hasSpent])

    const handleAutoLeave = useCallback(() => {
        setDismissedThisVisit(true)
        clearActiveImpression()
        // Only mark the whimsy cameo cooled down if it actually landed (never penalize a failed Lottie load),
        // and never spend the session's real stuck-help nudge cap.
        if (decision.show && !decision.isDemo && decision.mode === 'whimsy' && whimsyLandedRef.current) {
            whimsyLandedRef.current = false
            markSessionWhimsyShown()
            setMemory(recordSurfaceActionCooldown(userId, 'home_wave'))
        }
    }, [decision, userId])

    const handleDismiss = useCallback(() => {
        if (!decision.show) return
        setDismissedThisVisit(true)
        if (!decision.isDemo) {
            markSessionNudgeShown()
            clearActiveImpression()
            setMemory(recordSurfaceDismissal(userId, decision.surface))
        }
        posthog.capture(ANALYTICS_EVENTS.STUCK_BUDDY_DISMISSED, {
            surface: decision.surface,
            reason: decision.reason,
        })
    }, [decision, userId])

    const handleSubmitBugReport = useCallback(
        (category: BugReportCategory, categoryLabel: string, rawNote: string) => {
            const safeNote = rawNote ? redactSupportText(rawNote) : ''
            const replayUrl =
                !analyticsOptedOut && typeof posthog.get_session_replay_url === 'function'
                    ? posthog.get_session_replay_url()
                    : undefined
            posthog.capture(ANALYTICS_EVENTS.STUCK_BUG_REPORT_SUBMITTED, {
                category,
                has_note: Boolean(safeNote),
                route: effectiveRoute,
                error_code: runtime.lastErrorCode,
                replay_url: replayUrl ?? null,
            })
            Sentry.captureMessage(`stuck-buddy bug report: ${category}`, {
                level: 'info',
                tags: {
                    feature: 'stuck-detector',
                    category,
                    route: effectiveRoute,
                },
                extra: analyticsOptedOut
                    ? {
                          note: safeNote || undefined,
                          lastErrorCode: runtime.lastErrorCode,
                      }
                    : {
                          note: safeNote || undefined,
                          lastErrorCode: runtime.lastErrorCode,
                          replayUrl,
                      },
            })
            // Route every bug report straight into in-app SupportDrawer prefilled with the context
            // so the user gets a real reply without leaving the app (never silently overwrites clipboard).
            const prefilled = safeNote
                ? t('supportTopics.bugReportWithNote', {
                      category: categoryLabel,
                      route: effectiveRoute,
                      note: safeNote,
                  })
                : t('supportTopics.bugReport', {
                      category: categoryLabel,
                      route: effectiveRoute,
                  })
            if (modals) {
                modals.openSupportWithMessage(prefilled)
            }
        },
        [analyticsOptedOut, effectiveRoute, runtime.lastErrorCode, modals, t]
    )

    const clearance =
        variant === 'setup'
            ? 'setup-footer'
            : effectiveRoute.startsWith('/add-money') || effectiveRoute.startsWith('/verify')
              ? 'footer'
              : 'bottom-nav'

    const buddyCopy = (() => {
        if (!decision.show) return null
        switch (decision.surface) {
            case 'add_money':
                return { prompt: t('prompts.addMoney'), cta: t('ctas.addMoney') }
            case 'verify_loop':
                return { prompt: t('prompts.verifyLoop'), cta: t('ctas.contactSupport') }
            case 'setup_passkey':
                return { prompt: t('prompts.setupPasskey'), cta: t('ctas.contactSupport') }
            case 'home_funded':
                return { prompt: t('prompts.homeFunded'), cta: t('ctas.homeFunded') }
            case 'home_wave':
                return { prompt: '', cta: '' }
            case 'active_issue':
                return { prompt: t('prompts.activeIssue'), cta: t('ctas.activeIssue') }
        }
    })()

    return (
        <>
            <AnimatePresence>
                {decision.show && buddyCopy && (
                    <PeanutBuddy
                        key={`${decision.surface}-${decision.pose}`}
                        pose={decision.pose}
                        prompt={buddyCopy.prompt}
                        ctaLabel={buddyCopy.cta}
                        dismissLabel={t('a11y.dismiss')}
                        mascotLabel={t('a11y.openHelper')}
                        clearance={clearance}
                        whimsy={decision.mode === 'whimsy'}
                        onImpression={handleImpression}
                        onAction={handleBuddyAction}
                        onDismiss={handleDismiss}
                        onAutoLeave={handleAutoLeave}
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
                canUseQrPay={canUseQrPay}
                canUseCard={canUseCard}
                onClose={() => setDrawerSurface(null)}
                onNavigate={(href) => router.push(href)}
                onContactSupport={handleContactSupport}
            />
            <ActiveIssueDrawer
                open={drawerSurface === 'active_issue'}
                onClose={() => setDrawerSurface(null)}
                onSubmitBugReport={handleSubmitBugReport}
            />
        </>
    )
}

/** Mounted inside `(mobile-ui)/MobileLayoutClient.tsx` for authenticated in-app flows. */
export function StuckBuddyHost() {
    const { user } = useAuth()
    const { balance } = useWallet()
    const restrictions = useResidenceRestrictions()
    const { isRegionRestricted } = useIdentityVerification()
    const balanceUsd = balance !== undefined ? Number(balance) / 10 ** PEANUT_WALLET_TOKEN_DECIMALS : null
    const hasSpent = Boolean(user?.user?.isActivated)
    // Pix QR spending is available to Brazil residents (Avenia) and eligible non-residents (Manteca); gate only on region restriction.
    const canUseQrPay = !isRegionRestricted
    const canUseCard = !restrictions.card

    return (
        <StuckBuddyCore
            variant="app"
            balanceUsd={balanceUsd}
            hasSpent={hasSpent}
            canUseQrPay={canUseQrPay}
            canUseCard={canUseCard}
        />
    )
}

/** Mounted inside `(setup)/layout.tsx` for unauthenticated setup flows (no wallet queries). */
export function SetupStuckBuddyHost() {
    return <StuckBuddyCore variant="setup" balanceUsd={null} hasSpent={false} canUseQrPay={false} canUseCard={false} />
}

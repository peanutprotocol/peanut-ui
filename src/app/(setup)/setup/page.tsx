'use client'

import Loading from '@/components/Global/Loading'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { type ScreenId } from '@/components/Setup/Setup.types'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useSetupBackHandler } from '@/hooks/useSetupBackHandler'
import { dispatchBackPress } from '@/utils/back-handler'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupStepAnalytics } from '@/features/setup/useSetupStepAnalytics'
import { MASCOT_ANIMATION_LOADERS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { readInviteCode, stashInvite } from '@/utils/invite-stash'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { hasKnownDeviceCredentials, resolveSetupEntryStep } from '@/components/Setup/setup-entry'
import UnsupportedBrowserModal from '@/components/Global/UnsupportedBrowserModal'
import { harnessPasskeyBypass } from '@/constants/harness.consts'
import { isLikelyWebview, isDeviceOsSupported } from '@/components/Setup/Setup.utils'
import { isCapacitor } from '@/utils/capacitor'
import { isPwaSunsetOn } from '@/utils/migration.utils'
import { getStoredRedirect, toInviteCode } from '@/utils/general.utils'
import { useSearchParams } from 'next/navigation'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { useAuth } from '@/context/authContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useTranslations } from 'next-intl'
import { useModalsContext } from '@/context/ModalsContext'
import * as Sentry from '@sentry/nextjs'
import { EInviteType } from '@/services/services.types'
import {
    badgeCampaignsFromSearchParams,
    getPendingBadgeCampaigns,
    queuePendingBadgeCampaigns,
} from '@/components/Invites/badge-campaign-context'
import { claimAndSettlePendingBadgeCampaigns } from '@/services/badge-campaigns'
import { getDeepLinkGeneration, getDeepLinkTarget, subscribeToDeepLinkGeneration } from '@/utils/deep-link-state'
import { resolveSignupEntryFlow } from '@/features/setup/signup-analytics'

function setupTargetMatchesSearchParams(target: string | null, searchParamsString: string): boolean {
    if (!target) return false
    try {
        const targetUrl = new URL(target, 'https://peanut.me')
        if (targetUrl.pathname !== '/setup') return false
        const normalize = (params: URLSearchParams) =>
            Array.from(params.entries()).sort(
                ([keyA, valueA], [keyB, valueB]) => keyA.localeCompare(keyB) || valueA.localeCompare(valueB)
            )
        return (
            JSON.stringify(normalize(targetUrl.searchParams)) ===
            JSON.stringify(normalize(new URLSearchParams(searchParamsString)))
        )
    } catch {
        return false
    }
}

function SetupPageContent() {
    const t = useTranslations('setup')
    const tCommon = useTranslations('common')
    const { setIsSupportModalOpen } = useModalsContext()
    const { steps, setNoBackLockScreenId, setSignupEntryFlow } = useSetupFlowContext()
    const { step, currentIndex: currentStepIndex, direction, handleNext, handleBack, setScreenId } = useSetupFlow()
    useEffect(() => {
        const nextImage = steps[currentStepIndex + 1]?.image
        if (nextImage && 'pose' in nextImage) {
            void MASCOT_ANIMATION_LOADERS[nextImage.pose]().catch(() => {})
        }
    }, [steps, currentStepIndex])
    const { logoutUser, isLoggingOut, user, isFetchingUser, fetchUser } = useAuth()
    const router = useRouter()
    // The entry effect must run once per steps-identity, never per step change:
    // setScreenId's identity moves with the cursor, so it rides a ref.
    const setScreenIdRef = useRef(setScreenId)
    useLayoutEffect(() => {
        setScreenIdRef.current = setScreenId
    }, [setScreenId])
    const [isLoading, setIsLoading] = useState(true)
    const [initializationError, setInitializationError] = useState<string | null>(null)
    const initializationExpired = useRef(false)
    const [showDeviceNotSupportedModal, setShowDeviceNotSupportedModal] = useState(false)
    const [showBrowserNotSupportedModal, setShowBrowserNotSupportedModal] = useState(false)
    const { deviceType: detectedDeviceType } = useDeviceType()
    // Warm the geo cache at entry, not when the residence step mounts: the
    // lookup is a network round trip, and asking for it three steps early is
    // what lets that select render its suggestion already filled in.
    useGeoLocation()
    const searchParams = useSearchParams()
    // The init effect must key on the VALUES it reads, not the searchParams
    // object: the stepper rewrites ?screen= on every step, and a dep on the
    // object identity would re-run determineInitialStep mid-flow and bounce
    // the user back to the entry step.
    const inviteCodeParam = searchParams.get('code')
    const legacyStepParam = searchParams.get('step')
    const searchParamsString = searchParams.toString()
    const signupEntryFlow = useMemo(() => {
        const explicitRedirect = new URLSearchParams(searchParamsString).get('redirect_uri')
        return resolveSignupEntryFlow(explicitRedirect, explicitRedirect === null ? getStoredRedirect() : null)
    }, [searchParamsString])
    useEffect(() => setSignupEntryFlow(signupEntryFlow), [setSignupEntryFlow, signupEntryFlow])
    const urlBadgeCampaigns = useMemo(
        () => badgeCampaignsFromSearchParams(new URLSearchParams(searchParamsString)),
        [searchParamsString]
    )
    const [sessionChecked, setSessionChecked] = useState(false)
    /*
     * A completed session is on its way to /home (see the session effect
     * below), but the soft nav takes a beat and this page keeps rendering and
     * resolving its entry step meanwhile. Nothing here is a fault the user
     * should see: an authenticated pop back into /setup — the signup flow
     * leaves a history entry per step — showed the recovery screen instead of
     * the bounce it was already performing.
     */
    const [isLeavingForHome, setIsLeavingForHome] = useState(false)
    const [isSettlingNativeBadgeCampaigns, setIsSettlingNativeBadgeCampaigns] = useState(false)
    const [deepLinkGeneration, setDeepLinkGeneration] = useState(() => getDeepLinkGeneration())
    const isSetupMountedRef = useRef(false)
    const currentBadgeCampaignsKeyRef = useRef(urlBadgeCampaigns.join('\u0000'))
    const nativeClaimCampaignsKeyRef = useRef<string | null>(null)
    const nativeClaimGenerationRef = useRef<number | null>(null)
    const nativeClaimRunIdRef = useRef(0)
    const lastHandledDeepLinkGenerationRef = useRef(deepLinkGeneration)
    currentBadgeCampaignsKeyRef.current = urlBadgeCampaigns.join('\u0000')

    useEffect(() => subscribeToDeepLinkGeneration(() => setDeepLinkGeneration(getDeepLinkGeneration())), [])

    useEffect(() => {
        isSetupMountedRef.current = true
        return () => {
            isSetupMountedRef.current = false
        }
    }, [])

    const recoveryReason = isLeavingForHome
        ? null
        : (initializationError ??
          (!isLoading && sessionChecked && !step && !showDeviceNotSupportedModal && !showBrowserNotSupportedModal
              ? 'missing_step'
              : null))

    useEffect(() => {
        if (!recoveryReason) return
        if (recoveryReason === 'missing_step') {
            Sentry.addBreadcrumb({
                category: 'setup.recovery',
                level: 'info',
                message: 'Setup recovery required',
                data: { reason: recoveryReason },
            })
            return
        }
        Sentry.captureMessage('Setup initialization failed', {
            level: 'error',
            tags: { reason: recoveryReason },
        })
    }, [recoveryReason])

    useEffect(() => {
        if ((!isLoading && sessionChecked) || initializationError || isLeavingForHome) return
        const timeout = setTimeout(() => {
            initializationExpired.current = true
            setInitializationError('initialization_timeout')
        }, 15000)
        return () => clearTimeout(timeout)
    }, [isLoading, sessionChecked, initializationError, isLeavingForHome])

    // Only count steps that actually render, not while the entry step is being
    // determined or behind unsupported-device/browser modals.
    const stepRendered =
        !!step &&
        !recoveryReason &&
        !isLoading &&
        sessionChecked &&
        !showDeviceNotSupportedModal &&
        !showBrowserNotSupportedModal

    // Arm the point of no return only for a step the user actually SEES —
    // stepRendered excludes entry-resolution loading and unsupported modals.
    // A stale terminal URL
    // (?screen=sign-test-transaction in a fresh session) must stay unlockable
    // so the entry resolver can replace it (Chip review round 2).
    useEffect(() => {
        if (stepRendered && step && step.showBackButton === false) {
            setNoBackLockScreenId(step.screenId)
        }
    }, [stepRendered, step, setNoBackLockScreenId])

    useSetupStepAnalytics({
        enabled: stepRendered,
        step,
        steps,
        signupEntryFlow,
    })
    useSetupBackHandler({ step, canStepBack: stepRendered, onBack: handleBack })

    /*
     * A device can arrive at /setup already authenticated: a half-completed
     * earlier signup leaves durable credentials (jwt cookie in the native jar,
     * web-authn-key cookie), and running signup on top of them silently no-ops
     * — the passkey step would skip and the freshly chosen username would be
     * discarded. Check once, at entry: `sessionChecked` stays true for the rest
     * of the flow, while newer accepted native /setup generations are handled
     * separately so repeated invites cannot strand the loader.
     */
    useEffect(() => {
        if (isFetchingUser) return
        const isInitialSessionCheck = !sessionChecked
        const isNewSetupDeepLink =
            !isInitialSessionCheck &&
            deepLinkGeneration !== lastHandledDeepLinkGenerationRef.current &&
            setupTargetMatchesSearchParams(getDeepLinkTarget(), searchParamsString)
        if (!isInitialSessionCheck && !isNewSetupDeepLink) return
        if (isInitialSessionCheck) setSessionChecked(true)
        lastHandledDeepLinkGenerationRef.current = deepLinkGeneration

        // Native /invite links are rewritten to /setup because the invite page is
        // not part of the static export. Queue the campaign before the completed
        // session redirect can discard the query string, and settle it below for
        // users who are already authenticated.
        const pendingBadgeCampaigns =
            urlBadgeCampaigns.length > 0
                ? queuePendingBadgeCampaigns(urlBadgeCampaigns, 30)
                : getPendingBadgeCampaigns()

        if (user?.user?.username) {
            // Signup is open to every authenticated account. A stale legacy
            // hasAppAccess=false profile must not resurrect the retired
            // waitlist or offer to replace an already-created account.
            const nativeClaimDeepLinkGeneration = getDeepLinkGeneration()
            const nativeClaimCampaignsKey = pendingBadgeCampaigns.join('\u0000')
            const shouldSettleNativeBadgeCampaigns =
                isCapacitor() &&
                pendingBadgeCampaigns.length > 0 &&
                (nativeClaimCampaignsKeyRef.current !== nativeClaimCampaignsKey ||
                    nativeClaimGenerationRef.current !== nativeClaimDeepLinkGeneration)
            if (shouldSettleNativeBadgeCampaigns) {
                const nativeClaimRunId = nativeClaimRunIdRef.current + 1
                nativeClaimRunIdRef.current = nativeClaimRunId
                nativeClaimCampaignsKeyRef.current = nativeClaimCampaignsKey
                nativeClaimGenerationRef.current = nativeClaimDeepLinkGeneration
                const isCurrentNativeClaim = () =>
                    isSetupMountedRef.current &&
                    nativeClaimRunIdRef.current === nativeClaimRunId &&
                    getDeepLinkGeneration() === nativeClaimDeepLinkGeneration &&
                    currentBadgeCampaignsKeyRef.current === urlBadgeCampaigns.join('\u0000')
                setIsSettlingNativeBadgeCampaigns(true)
                void claimAndSettlePendingBadgeCampaigns(pendingBadgeCampaigns)
                    .then(async (batch) => {
                        if (!isCurrentNativeClaim()) return

                        const hasConfirmedClaim = batch.claims.some(
                            ({ outcome }) => outcome === 'awarded' || outcome === 'already_owned'
                        )
                        if (hasConfirmedClaim) {
                            try {
                                await fetchUser()
                                if (!isCurrentNativeClaim()) return
                            } catch (error) {
                                Sentry.captureException(error, {
                                    tags: { error_type: 'native_campaign_profile_refresh_failed' },
                                })
                            }
                        }
                    })
                    .catch((error) => {
                        if (!isCurrentNativeClaim()) return
                        Sentry.captureException(error, { tags: { error_type: 'native_campaign_claim_failed' } })
                    })
                    .finally(() => {
                        if (isCurrentNativeClaim()) {
                            setIsSettlingNativeBadgeCampaigns(false)
                            router.replace('/home')
                        } else if (isSetupMountedRef.current && nativeClaimRunIdRef.current === nativeClaimRunId) {
                            // A newer native link may keep this setup instance
                            // mounted while Next transitions to its new URL.
                            // Release the old loader until the latest URL's
                            // effect starts its replacement settlement.
                            setIsSettlingNativeBadgeCampaigns(false)
                        }
                    })
                return
            }
            if (isNewSetupDeepLink) {
                setIsSettlingNativeBadgeCampaigns(false)
                router.replace('/home')
                return
            }
            if (!isInitialSessionCheck) return
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_EXISTING_SESSION_CONTINUED, { auto: true })
            setIsLeavingForHome(true)
            router.replace('/home')
            return
        }
    }, [
        sessionChecked,
        isFetchingUser,
        user,
        router,
        fetchUser,
        urlBadgeCampaigns,
        deepLinkGeneration,
        searchParamsString,
    ])

    useEffect(() => {
        let cancelled = false
        const isObsolete = () => cancelled || initializationExpired.current
        const determineInitialStep = async () => {
            if (isObsolete()) return
            // wait for layout to populate steps after logout/mount
            if (!steps || steps.length === 0) {
                console.log('[SetupPage] waiting for steps to be initialized by layout...')
                setIsLoading(true)
                return
            }

            setIsLoading(true)
            await new Promise((resolve) => setTimeout(resolve, 100)) // ensure other initializations can complete
            if (isObsolete()) return

            // The entry-step rules (invite code / ?step=signup opening the form
            // directly, ?step=login, a known device going to Log In) live in
            // resolveSetupEntryStep. After authentication, useZeroDev submits the
            // queued opaque campaign list to the canonical claim service; the step
            // decision never interprets that cookie.
            //
            // Why not the campaignTag cookie: retryable campaign acquisition can
            // intentionally persist for 30 days. Using it as onboarding state would
            // route a returning user past Landing onto Signup (regression from PR #2346).
            /*
             * ?code= arrives from an /invite deep link (native maps
             * peanut.me/invite?code=X here — see native-routes.ts). Persist it
             * as the same session cookie the web InvitesPage writes, so it
             * survives the multi-step signup and reaches registration.
             */
            const codeFromUrl = inviteCodeParam
            if (codeFromUrl && toInviteCode(codeFromUrl)) {
                stashInvite(toInviteCode(codeFromUrl), EInviteType.DIRECT)
            }
            const userInviteCode = readInviteCode()
            // During the native-app cutover, web signups are closed (Landing hides
            // Sign up), so the ?step=signup / invite-code jump must not skip
            // past the landing gate — otherwise claim/invite links deep-link
            // straight into the signup form. Native app keeps the fast path.
            const webSignupClosed = isPwaSunsetOn() && !isCapacitor()
            const entryInput = {
                hasInviteCode: !!userInviteCode,
                stepParam: legacyStepParam,
                webSignupClosed,
                knownDevice: hasKnownDeviceCredentials(),
            }

            const localDeviceType = detectedDeviceType

            // The web-signup sunset is a product-access decision, not a
            // capability check. Resolve it before legacy passkey, OS, and
            // webview gates so every browser can reach Landing's Log In and
            // native-store actions, including devices that cannot onboard.
            if (webSignupClosed) {
                const targetStep = resolveSetupEntryStep(entryInput)
                if (!steps.some((s) => s.screenId === targetStep)) throw new Error('Setup entry step is missing')
                setScreenIdRef.current(targetStep, { history: 'replace' })
                setIsLoading(false)
                return
            }

            // In Capacitor, passkeys are handled natively. Skip browser, webview, and OS checks.
            if (isCapacitor()) {
                const targetStep = resolveSetupEntryStep(entryInput)
                // replace, not push: the entry step overwrites any stale
                // ?screen= from a reload or shared link — the URL is only the
                // source of truth for IN-FLOW navigation (TASK-21460)
                if (!steps.some((s) => s.screenId === targetStep)) throw new Error('Setup entry step is missing')
                setScreenIdRef.current(targetStep, { history: 'replace' })
                setIsLoading(false)
                return
            }

            // check if device has a platform authenticator (biometric/pin).
            // capacitor already returned above — this only runs on web.
            // The harness browser has no authenticator and signs with its own
            // key, so the probe there only walls the QA run off its first
            // screen. Production has neither harness signal.
            let passkeySupport = true
            if (!harnessPasskeyBypass()) {
                try {
                    if (PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
                        passkeySupport = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                    }
                } catch (e) {
                    passkeySupport = false
                    console.error('Error checking passkey support:', e)
                }
            }

            if (isObsolete()) return

            const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
            const osSupportedByVersion = isDeviceOsSupported(ua)
            const webviewByUASignature = isLikelyWebview() // initial webview check based on ua signatures

            // webview detection: if it's an ios device, looks like safari, lacks passkey support,
            // and wasn't caught by signatures, it's likely a restricted webview (e.g., telegram)
            let effectiveCurrentlyInWebview = webviewByUASignature
            if (localDeviceType === 'ios' && /Safari/.test(ua) && !passkeySupport && !webviewByUASignature) {
                effectiveCurrentlyInWebview = true
                console.warn(
                    'INFO: Detected likely iOS webview (Safari-like UA, no passkey support, not caught by signatures).'
                )
            }

            let determinedSetupInitialStepId: ScreenId | undefined = undefined

            // main decision logic for showing modals or proceeding with setup
            if (effectiveCurrentlyInWebview) {
                // If a webview does not support passkeys, show the unsupported browser modal.
                if (!passkeySupport) {
                    setShowBrowserNotSupportedModal(true)
                    setIsLoading(false)
                    return
                }
            } else {
                // not in an effective webview
                if (!osSupportedByVersion) {
                    // if os version is too old, show device not supported modal
                    setShowDeviceNotSupportedModal(true)
                    setIsLoading(false)
                    return
                } else if (!passkeySupport) {
                    // if os is fine but passkeys are still not supported (e.g., old browser on supported os),
                    // show device not supported modal
                    setShowDeviceNotSupportedModal(true)
                    setIsLoading(false)
                    return
                }
            }

            // if no modal was triggered, proceed to determine actual setup step
            determinedSetupInitialStepId = resolveSetupEntryStep(entryInput)

            // Entry always REPLACES — a stale ?screen= must never survive a
            // fresh load into a step whose prerequisite state is gone.
            if (!determinedSetupInitialStepId || !steps.some((s) => s.screenId === determinedSetupInitialStepId)) {
                throw new Error('Setup entry step is missing')
            }
            setScreenIdRef.current(determinedSetupInitialStepId, { history: 'replace' })

            setIsLoading(false)
        }

        void determineInitialStep().catch(() => {
            if (isObsolete()) return
            setInitializationError('initialization_failed')
            setIsLoading(false)
        })

        return () => {
            cancelled = true
        }
    }, [steps, inviteCodeParam, legacyStepParam])

    if (recoveryReason) {
        return (
            <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 p-6">
                <h1 className="text-center text-heading-m">{tCommon('somethingWentWrong')}</h1>
                <p className="text-center">{tCommon('genericError')}</p>
                <div className="flex w-full max-w-sm flex-col gap-3">
                    <Button onClick={() => window.location.reload()}>{tCommon('tryAgain')}</Button>
                    <Button variant="secondary" onClick={() => setIsSupportModalOpen(true)}>
                        {tCommon('contactSupport')}
                    </Button>
                </div>
            </div>
        )
    }

    if (isLoading || !sessionChecked || isLeavingForHome || isSettlingNativeBadgeCampaigns)
        return (
            <div className="flex h-dvh w-full flex-col items-center justify-center">
                <Loading variant="mascot" />
            </div>
        )

    if (showBrowserNotSupportedModal || showDeviceNotSupportedModal) {
        return <UnsupportedBrowserModal visible={true} allowClose={false} />
    }

    if (!step) return null

    const titleKey = `steps.${step.screenId}.title` as Parameters<typeof t>[0]
    const descriptionKey = `steps.${step.screenId}.description` as Parameters<typeof t>[0]

    return (
        <SetupWrapper
            layoutType={step.layoutType}
            screenId={step.screenId}
            image={step.image}
            title={!step.titleInView ? t(titleKey) : undefined}
            description={!step.descriptionInView && t.has(descriptionKey) ? t(descriptionKey) : undefined}
            showBackButton={step.showBackButton}
            showSkipButton={step.showSkipButton}
            showLogoutButton={step.screenId === 'sign-test-transaction'}
            imageClassName={step.imageClassName}
            // The visible back button walks the same handler stack as hardware
            // back, so a step's sub-view (residence heads-up) collapses first
            // instead of being skipped straight to the previous step. The page
            // handler below it steps back when nothing consumed the press.
            onBack={dispatchBackPress}
            onSkip={() => handleNext()}
            onLogout={logoutUser}
            isLoggingOut={isLoggingOut}
            step={currentStepIndex}
            totalSteps={steps.length}
            direction={direction}
            titleClassName={step.titleClassName}
            contentClassName={step.contentClassName}
        >
            <step.component />
        </SetupWrapper>
    )
}

export default function SetupPage() {
    return (
        <Suspense fallback={<Loading variant="mascot" coverFullScreen />}>
            <SetupPageContent />
        </Suspense>
    )
}

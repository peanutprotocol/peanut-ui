'use client'

import { useHydrationSnapshot } from '@/utils/native-platform'
import Loading from '@/components/Global/Loading'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { type ScreenId } from '@/components/Setup/Setup.types'
import { postRegistrationScreen, useSetupFlow } from '@/hooks/useSetupFlow'
import { setupCountrySuggestion } from '@/features/setup/country-signals'
import { useSetupBackHandler } from '@/hooks/useSetupBackHandler'
import { dispatchBackPress } from '@/utils/back-handler'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupStepAnalytics } from '@/features/setup/useSetupStepAnalytics'
import { MASCOT_ANIMATION_LOADERS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { readInviteCode, stashInvite } from '@/utils/invite-stash'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSetupStepCopy } from '@/components/Setup/useSetupStepCopy'
import { hasKnownDeviceCredentials, resolveSetupEntryStep } from '@/components/Setup/setup-entry'
import UnsupportedBrowserModal from '@/components/Global/UnsupportedBrowserModal'
import { harnessPasskeyBypass } from '@/constants/harness.consts'
import { isLikelyWebview, isDeviceOsSupported } from '@/components/Setup/Setup.utils'
import { isCapacitor } from '@/utils/capacitor'
import { isPwaSunsetOn } from '@/utils/migration.utils'
import { getStoredRedirect, getValidRedirectUrl, toInviteCode } from '@/utils/general.utils'
import { useSearchParams } from 'next/navigation'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { useSetupCountrySignals } from '@/features/setup/useSetupCountrySignals'
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
import { AccountType, type IUserProfile } from '@/interfaces/interfaces'
import { isDemoMode } from '@/utils/demo'

// The steps after registration; reaching any of them arms the no-back lock.
const POST_REGISTRATION_SCREENS: readonly ScreenId[] = [
    'residence',
    'invite',
    'advantage-fees',
    'advantage-card',
    'payment-plan',
    'notification-email',
    'notification-permission',
    'advantage-control',
]

/** The last step creates the wallet: a registered account without one left the flow before finishing it. */
function hasUnfinishedSignup(profile: IUserProfile): boolean {
    return !isDemoMode() && !profile.accounts?.some((account) => account.type === AccountType.PEANUT_WALLET)
}

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
    const tCommon = useTranslations('common')
    const { setIsSupportModalOpen } = useModalsContext()
    const {
        steps,
        noBackLockScreenId,
        setNoBackLockScreenId,
        sellScreensCountry,
        setSellScreensCountry,
        setSignupEntryFlow,
        setSignupCompleted,
        signupCompleted,
    } = useSetupFlowContext()
    const {
        step,
        currentIndex: currentStepIndex,
        direction,
        handleNext,
        handleBack,
        setScreenId,
        isLoading: flowLoading,
    } = useSetupFlow()
    useEffect(() => {
        const nextImage = steps[currentStepIndex + 1]?.image
        if (nextImage && 'pose' in nextImage) {
            void MASCOT_ANIMATION_LOADERS[nextImage.pose]().catch(() => {})
        }
    }, [steps, currentStepIndex])
    const stepCopy = useSetupStepCopy(step)
    const { user, isFetchingUser, fetchUser } = useAuth()
    const router = useRouter()
    // The entry effect must run once per steps-identity, never per step change:
    // setScreenId's identity moves with the cursor, so it rides a ref.
    const setScreenIdRef = useRef(setScreenId)
    useLayoutEffect(() => {
        setScreenIdRef.current = setScreenId
    }, [setScreenId])
    const resolvedEntry = useRef<string | null>(null)
    const resumeSignup = useRef(false)
    const [isLoading, setIsLoading] = useState(true)
    const [initializationError, setInitializationError] = useState<string | null>(null)
    const initializationExpired = useRef(false)
    const [showDeviceNotSupportedModal, setShowDeviceNotSupportedModal] = useState(false)
    const [showBrowserNotSupportedModal, setShowBrowserNotSupportedModal] = useState(false)
    const { deviceType: detectedDeviceType } = useDeviceType()
    // Warm the geo cache at entry, not when the residence step mounts: the
    // lookup is a network round trip, and asking for it three steps early is
    // what lets that select render its suggestion already filled in.
    const countrySignals = useSetupCountrySignals()
    const searchParams = useSearchParams()
    // The init effect must key on the VALUES it reads, not the searchParams
    // object: the stepper rewrites ?screen= on every step, and a dep on the
    // object identity would re-run determineInitialStep mid-flow and bounce
    // the user back to the entry step.
    const inviteCodeParam = searchParams.get('code')
    const legacyStepParam = searchParams.get('step')
    const searchParamsString = searchParams.toString()
    const signupEntryFlow = useHydrationSnapshot(
        () => {
            const explicitRedirect = new URLSearchParams(searchParamsString).get('redirect_uri')
            return resolveSignupEntryFlow(explicitRedirect, explicitRedirect === null ? getStoredRedirect() : null)
        },
        () => resolveSignupEntryFlow(new URLSearchParams(searchParamsString).get('redirect_uri'), null)
    )
    useEffect(() => setSignupEntryFlow(signupEntryFlow), [setSignupEntryFlow, signupEntryFlow])
    const urlBadgeCampaigns = useMemo(
        () => badgeCampaignsFromSearchParams(new URLSearchParams(searchParamsString)),
        [searchParamsString]
    )
    const [sessionChecked, setSessionChecked] = useState(false)
    /*
     * A completed session is on its way to /home or its explicit redirect_uri
     * (see the session effect below), but the soft nav takes a beat and this
     * page keeps rendering and resolving its entry step meanwhile. Nothing
     * here is a fault the user should see: an authenticated pop back into
     * /setup — the signup flow leaves a history entry per step — showed the
     * recovery screen instead of the bounce it was already performing.
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

    // Registration happens on the username step and is irreversible: every
    // later step locks the way back at the first step after it, while the steps
    // after that stay revisitable. This also restores the boundary for a resumed
    // later step, and follows the list when it changes. The sell screens' country
    // is fixed here too, so they do not change under the person.
    useEffect(() => {
        if (stepRendered && !signupCompleted && step && POST_REGISTRATION_SCREENS.includes(step.screenId)) {
            setNoBackLockScreenId(postRegistrationScreen(steps.map((entry) => entry.screenId)))
            if (sellScreensCountry === undefined) {
                setSellScreensCountry(setupCountrySuggestion(countrySignals)?.country ?? null)
            }
        }
    }, [
        stepRendered,
        step,
        steps,
        signupCompleted,
        setNoBackLockScreenId,
        sellScreensCountry,
        setSellScreensCountry,
        countrySignals,
    ])
    const showBackButton =
        !!step?.showBackButton && step.screenId !== noBackLockScreenId && !signupCompleted && !flowLoading

    useSetupStepAnalytics({
        enabled: stepRendered,
        step,
        steps,
        signupEntryFlow,
    })
    useSetupBackHandler({ step, canStepBack: stepRendered && showBackButton, onBack: handleBack })

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
            //
            // A completed account still honours an explicit redirect_uri: a
            // link that sends it here on the way to a page (/add-money) must
            // reach that page, not /home. Only the explicit param counts;
            // stored redirect state is left alone. A redirect back into /setup
            // would keep this page mounted behind its loader, so it goes home.
            const explicitRedirect = new URLSearchParams(searchParamsString).get('redirect_uri')
            const safeRedirect = explicitRedirect ? getValidRedirectUrl(explicitRedirect, '/home') : '/home'
            const signedInExit = safeRedirect.startsWith('/setup') ? '/home' : safeRedirect
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
                            router.replace(signedInExit)
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
                router.replace(signedInExit)
                return
            }
            if (!isInitialSessionCheck) return
            if (hasUnfinishedSignup(user)) {
                /*
                 * A reload (a deploy's service worker, chunk recovery, pull to
                 * refresh) mid-signup lands here signed in. /home would send it
                 * to /setup/finish, which only creates the wallet: the email and
                 * every other step after registration were silently skipped.
                 * Entry never trusts a reloaded ?screen=, so restart at the
                 * first step after registration.
                 */
                resumeSignup.current = true
                if (resolvedEntry.current !== null) {
                    setScreenIdRef.current(postRegistrationScreen(steps.map((entry) => entry.screenId)), {
                        history: 'replace',
                    })
                }
                return
            }
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_EXISTING_SESSION_CONTINUED, { auto: true })
            setIsLeavingForHome(true)
            router.replace(signedInExit)
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
        steps,
    ])

    useEffect(() => {
        let cancelled = false
        const isObsolete = () => cancelled || initializationExpired.current
        const determineInitialStep = async () => {
            const entryKey = JSON.stringify([inviteCodeParam, legacyStepParam])
            if (isObsolete() || resolvedEntry.current === entryKey) return
            // wait for layout to populate steps after logout/mount
            if (!steps || steps.length === 0) {
                console.log('[SetupPage] waiting for steps to be initialized by layout...')
                setIsLoading(true)
                return
            }

            setIsLoading(true)
            await new Promise((resolve) => setTimeout(resolve, 100)) // ensure other initializations can complete
            if (isObsolete()) return
            const entryScreen = (target: ScreenId): ScreenId =>
                resumeSignup.current ? postRegistrationScreen(steps.map((entry) => entry.screenId)) : target

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
             * peanut.me/invite?code=X here — see native-routes.ts). Stash it
             * like the web InvitesPage does, so it survives the multi-step
             * signup and reaches registration.
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
                const targetStep = entryScreen(resolveSetupEntryStep(entryInput))
                if (!steps.some((s) => s.screenId === targetStep)) throw new Error('Setup entry step is missing')
                resolvedEntry.current = entryKey
                setScreenIdRef.current(targetStep, { history: 'replace' })
                setIsLoading(false)
                return
            }

            // In Capacitor, passkeys are handled natively. Skip browser, webview, and OS checks.
            if (isCapacitor()) {
                const targetStep = entryScreen(resolveSetupEntryStep(entryInput))
                // replace, not push: the entry step overwrites any stale
                // ?screen= from a reload or shared link — the URL is only the
                // source of truth for IN-FLOW navigation (TASK-21460)
                if (!steps.some((s) => s.screenId === targetStep)) throw new Error('Setup entry step is missing')
                resolvedEntry.current = entryKey
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
            determinedSetupInitialStepId = entryScreen(resolveSetupEntryStep(entryInput))

            // Entry always REPLACES — a stale ?screen= must never survive a
            // fresh load into a step whose prerequisite state is gone.
            if (!determinedSetupInitialStepId || !steps.some((s) => s.screenId === determinedSetupInitialStepId)) {
                throw new Error('Setup entry step is missing')
            }
            resolvedEntry.current = entryKey
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

    return (
        <SetupWrapper
            fullScreen={step.fullScreen}
            showProgress={!signupCompleted}
            layoutType={step.layoutType}
            screenId={step.screenId}
            image={step.image}
            {...stepCopy}
            showBackButton={showBackButton}
            showSkipButton={step.showSkipButton}
            imageClassName={step.imageClassName}
            // The visible back button walks the same handler stack as hardware
            // back, so a step's sub-view (residence heads-up) collapses first
            // instead of being skipped straight to the previous step. The page
            // handler below it steps back when nothing consumed the press.
            onBack={dispatchBackPress}
            onSkip={() => handleNext()}
            step={currentStepIndex}
            direction={direction}
            titleClassName={step.titleClassName}
            contentClassName={step.contentClassName}
        >
            <step.component
                entryDirection={direction}
                onComplete={
                    step.screenId === 'advantage-control'
                        ? () => {
                              setNoBackLockScreenId('advantage-control')
                              setSignupCompleted(true)
                          }
                        : undefined
                }
            />
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

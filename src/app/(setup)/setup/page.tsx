'use client'

import { useHydrationSnapshot } from '@/utils/native-platform'
import Loading from '@/components/Global/Loading'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { type ScreenId } from '@/components/Setup/Setup.types'
import { postRegistrationScreen, useSetupFlow } from '@/hooks/useSetupFlow'
import { setupCountrySuggestion } from '@/features/setup/country-signals'
import { useSetupBackHandler } from '@/hooks/useSetupBackHandler'
import { dispatchBackPress } from '@/utils/back-handler'
import { isUntouchedNotificationChoices, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import {
    POST_REGISTRATION_SCREENS,
    REGISTERED_PROGRESS_SCREENS,
    readSignupProgress,
    resumeScreen,
    saveSignupProgress,
} from '@/features/setup/signup-progress'
import { useSetupStepAnalytics } from '@/features/setup/useSetupStepAnalytics'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { MASCOT_ANIMATION_LOADERS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { readInviteCode, stashInvite } from '@/utils/invite-stash'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSetupStepCopy } from '@/components/Setup/useSetupStepCopy'
import { hasKnownDeviceCredentials, resolveSetupEntryStep } from '@/components/Setup/setup-entry'
import { isCapacitor } from '@/utils/capacitor'
import { hasKeepWebCookie, isKeepWebLink } from '@/utils/migration.utils'
import { KEEP_WEB_COOKIE } from '@/constants/migration.consts'
import { getStoredRedirect, getValidRedirectUrl, toInviteCode } from '@/utils/general.utils'
import { useSearchParams } from 'next/navigation'
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
import { isDemoMode } from '@/utils/demo'
import { unfinishedSignupRoute } from '@/features/setup/unfinished-signup'
import { disableLandingAutoLogin } from '@/features/setup/landing-auto-login'
import {
    bindSignupDraft,
    discardSignupDraft,
    readSignupDraft,
    restoreSignupDraft,
    saveSignupDraft,
    type SignupDraft,
} from '@/features/setup/signup-draft'
import { flushPendingSignupAnswers } from '@/features/setup/saveSignupAnswers'
import { SETUP_FEATURE_SCREENS } from '@/features/setup/filterSetupSteps'

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
        masterScreenIds,
        residenceCountry,
        setResidenceCountry,
        nationalityCountry,
        setNationalityCountry,
        fundingChannel,
        setFundingChannel,
        paymentChannel,
        setPaymentChannel,
        notificationChoices,
        setNotificationChoices,
        inviterAccepted,
        setInviterAccepted,
        username,
        setUsername,
        inviteSelection,
        setInviteSelection,
        featureScreenIds,
        setFeatureScreenIds,
        registrationInProgress,
        resetSetupFlow,
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
    const { user, isFetchingUser, userFetchError, fetchUser } = useAuth()
    const router = useRouter()
    const signedInUserId = user?.user?.userId
    // The entry effect must run once per steps-identity, never per step change:
    // setScreenId's identity moves with the cursor, so it rides a ref.
    const setScreenIdRef = useRef(setScreenId)
    useLayoutEffect(() => {
        setScreenIdRef.current = setScreenId
    }, [setScreenId])
    const resolvedEntry = useRef<string | null>(null)
    const resumeSignup = useRef(false)
    // A live flow, not a reloaded ?screen=: this mount has rendered a step after registration.
    const shownPostRegistration = useRef(false)
    // Async exits (a native badge claim settling) must read the latest list and cursor.
    const stepsRef = useRef(steps)
    stepsRef.current = steps
    const currentScreenRef = useRef(step?.screenId)
    currentScreenRef.current = step?.screenId
    const userIdRef = useRef<string | undefined>(undefined)
    userIdRef.current = signedInUserId
    const progressRestored = useRef(false)
    const progressOwned = useRef(false)
    const handledIdentity = useRef(signedInUserId)
    const registrationIdentity = useRef<string | undefined>(undefined)
    const restoredDraft = useRef<SignupDraft | null>(null)
    const [draftReady, setDraftReady] = useState(false)
    const legacyRecoveryBoundary = useRef<ScreenId | null>(null)
    useEffect(() => {
        let cancelled = false
        void restoreSignupDraft()
            .then((draft) => {
                if (cancelled) return
                restoredDraft.current = draft
                if (draft && (!userIdRef.current || draft.userId === userIdRef.current)) {
                    const { answers } = draft
                    setUsername(answers.username)
                    setInviteSelection(answers.inviteSelection)
                    setResidenceCountry(answers.residenceCountry)
                    setNationalityCountry(answers.nationalityCountry)
                    setFundingChannel(answers.fundingChannel)
                    setPaymentChannel(answers.paymentChannel)
                    if (answers.notificationChoices) setNotificationChoices(answers.notificationChoices)
                    setInviterAccepted(answers.inviterAccepted)
                    setSellScreensCountry(answers.sellScreensCountry)
                    if (draft.featureScreenIds) setFeatureScreenIds(draft.featureScreenIds)
                }
                setDraftReady(true)
            })
            .catch(() => {
                if (!cancelled) setDraftReady(true)
            })
        return () => {
            cancelled = true
        }
    }, [
        setFeatureScreenIds,
        setFundingChannel,
        setInviteSelection,
        setInviterAccepted,
        setNationalityCountry,
        setNotificationChoices,
        setPaymentChannel,
        setResidenceCountry,
        setSellScreensCountry,
        setUsername,
    ])
    /*
     * Where a reloaded or restarted signup continues: the step saved on this
     * device, with the answers given before it, so a person who reached the
     * last step is not walked through residence, plan and email again.
     */
    const resumeTarget = (): ScreenId => {
        const userId = userIdRef.current
        const ownedDraft = restoredDraft.current?.userId === userId ? restoredDraft.current : null
        const progress =
            (userId ? readSignupProgress(userId) : null) ??
            (ownedDraft
                ? {
                      screenId: POST_REGISTRATION_SCREENS.includes(ownedDraft.screenId)
                          ? ownedDraft.screenId
                          : ('notification-email' as ScreenId),
                      answers: ownedDraft.answers,
                  }
                : null)
        const restore = !progressRestored.current
        progressRestored.current = true
        if (progress && restore) {
            const { answers } = progress
            if (answers.residenceCountry) setResidenceCountry(answers.residenceCountry)
            if (answers.nationalityCountry) setNationalityCountry(answers.nationalityCountry)
            if (answers.fundingChannel) setFundingChannel(answers.fundingChannel)
            if (answers.paymentChannel) setPaymentChannel(answers.paymentChannel)
            if (answers.notificationChoices) setNotificationChoices(answers.notificationChoices)
            if (answers.inviterAccepted) setInviterAccepted(true)
            if (answers.sellScreensCountry !== undefined) setSellScreensCountry(answers.sellScreensCountry)
        }
        const target = resumeScreen(
            progress,
            stepsRef.current.map((entry) => entry.screenId),
            masterScreenIds
        )
        if (!ownedDraft) legacyRecoveryBoundary.current = target
        setNoBackLockScreenId(target)
        return target
    }
    const resumeTargetRef = useRef(resumeTarget)
    resumeTargetRef.current = resumeTarget
    const [isLoading, setIsLoading] = useState(true)
    const [initializationError, setInitializationError] = useState<string | null>(null)
    const [initializationAttempt, setInitializationAttempt] = useState(0)
    const initializationExpired = useRef(false)
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
    const keepWebParam = searchParams.get(KEEP_WEB_COOKIE)
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

    const profileFetchFailed = !!userFetchError && !user
    useEffect(() => {
        if (profileFetchFailed) setSessionChecked(false)
    }, [profileFetchFailed])

    const pendingRecoveryReason = profileFetchFailed
        ? 'profile_fetch_failed'
        : isLeavingForHome
          ? null
          : (initializationError ?? (!isLoading && sessionChecked && !step ? 'missing_step' : null))
    const retryingInitialization =
        !!pendingRecoveryReason && pendingRecoveryReason !== 'profile_fetch_failed' && initializationAttempt === 0
    const recoveryReason = retryingInitialization ? null : pendingRecoveryReason

    useEffect(() => {
        if (!retryingInitialization) return
        initializationExpired.current = false
        resolvedEntry.current = null
        setInitializationError(null)
        setIsLoading(true)
        setInitializationAttempt(1)
    }, [retryingInitialization])

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
        if ((!isLoading && sessionChecked) || initializationError || isLeavingForHome || profileFetchFailed) return
        const timeout = setTimeout(() => {
            initializationExpired.current = true
            setInitializationError('initialization_timeout')
        }, 15000)
        return () => clearTimeout(timeout)
    }, [isLoading, sessionChecked, initializationError, isLeavingForHome, profileFetchFailed, initializationAttempt])

    // Only count steps that actually render, not while the entry step is being determined.
    const stepRendered = !!step && !recoveryReason && !isLoading && sessionChecked

    useLayoutEffect(() => {
        if (stepRendered && step?.screenId !== 'landing') disableLandingAutoLogin()
    }, [stepRendered, step?.screenId])

    useLayoutEffect(() => {
        if (!stepRendered || !step || step.screenId === 'landing' || featureScreenIds !== null) return
        setFeatureScreenIds(
            steps.filter((entry) => SETUP_FEATURE_SCREENS.includes(entry.screenId)).map((entry) => entry.screenId)
        )
        if (sellScreensCountry === undefined)
            setSellScreensCountry(setupCountrySuggestion(countrySignals)?.country ?? null)
    }, [
        stepRendered,
        step,
        steps,
        featureScreenIds,
        setFeatureScreenIds,
        sellScreensCountry,
        setSellScreensCountry,
        countrySignals,
    ])

    // Legacy recovery stays revisitable until Email becomes the registration boundary.
    useEffect(() => {
        if (
            stepRendered &&
            !signupCompleted &&
            step &&
            user?.user?.username &&
            (resumeSignup.current || POST_REGISTRATION_SCREENS.includes(step.screenId))
        ) {
            shownPostRegistration.current = true
            const boundary = POST_REGISTRATION_SCREENS.includes(step.screenId)
                ? postRegistrationScreen(steps.map((entry) => entry.screenId))
                : legacyRecoveryBoundary.current
            if (boundary) setNoBackLockScreenId(boundary)
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
        user,
    ])
    useEffect(() => {
        if (!draftReady || !stepRendered || signupCompleted || !step || signedInUserId) return
        saveSignupDraft({
            screenId: step.screenId,
            answers: {
                username,
                inviteSelection,
                residenceCountry,
                nationalityCountry,
                fundingChannel,
                paymentChannel,
                notificationChoices: isUntouchedNotificationChoices(notificationChoices) ? null : notificationChoices,
                inviterAccepted,
                sellScreensCountry,
            },
            ...(featureScreenIds === null ? {} : { featureScreenIds }),
        })
    }, [
        draftReady,
        stepRendered,
        signupCompleted,
        step,
        signedInUserId,
        username,
        inviteSelection,
        residenceCountry,
        nationalityCountry,
        fundingChannel,
        paymentChannel,
        notificationChoices,
        inviterAccepted,
        sellScreensCountry,
        featureScreenIds,
    ])
    useEffect(() => {
        if (!stepRendered || signupCompleted || !step || !signedInUserId) return
        if (!registrationInProgress && !resumeSignup.current && readSignupDraft()?.userId !== signedInUserId) return
        if (!REGISTERED_PROGRESS_SCREENS.includes(step.screenId) || step.screenId === 'invite') return
        // Never overwrite saved answers before this mount has restored them.
        if (!progressOwned.current) {
            if (!progressRestored.current && readSignupProgress(signedInUserId)) return
            progressOwned.current = true
        }
        saveSignupProgress(signedInUserId, {
            screenId: step.screenId,
            answers: {
                residenceCountry,
                nationalityCountry,
                fundingChannel,
                paymentChannel,
                notificationChoices: isUntouchedNotificationChoices(notificationChoices) ? null : notificationChoices,
                inviterAccepted,
                sellScreensCountry,
            },
        })
    }, [
        stepRendered,
        signupCompleted,
        step,
        signedInUserId,
        residenceCountry,
        nationalityCountry,
        fundingChannel,
        paymentChannel,
        notificationChoices,
        inviterAccepted,
        sellScreensCountry,
        registrationInProgress,
    ])
    const showBackButton =
        !!step?.showBackButton &&
        step.screenId !== noBackLockScreenId &&
        !signupCompleted &&
        !flowLoading &&
        !registrationInProgress

    useSetupStepAnalytics({
        enabled: stepRendered,
        step,
        steps,
        signupEntryFlow,
    })
    useSetupBackHandler({ step, canStepBack: stepRendered && showBackButton, onBack: handleBack })
    const { track: trackErrorScreen } = useSignupControl('setup-error')

    useEffect(() => {
        if (!draftReady || isFetchingUser || isDemoMode()) return
        if (registrationInProgress) {
            if (signedInUserId) registrationIdentity.current = signedInUserId
            return
        }
        if (handledIdentity.current === signedInUserId) return
        handledIdentity.current = signedInUserId
        if (
            !signedInUserId ||
            registrationIdentity.current === signedInUserId ||
            readSignupDraft()?.userId === signedInUserId
        )
            return
        discardSignupDraft()
        restoredDraft.current = null
        resetSetupFlow()
        resolvedEntry.current = null
        shownPostRegistration.current = false
        progressRestored.current = false
        progressOwned.current = false
        resumeSignup.current = false
        legacyRecoveryBoundary.current = null
        setSessionChecked(false)
        setIsLoading(true)
    }, [draftReady, isFetchingUser, registrationInProgress, signedInUserId, resetSetupFlow])

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
        if (isFetchingUser || profileFetchFailed || !draftReady) return
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
            if (!registrationInProgress) {
                const draft = readSignupDraft()
                if (draft && draft.userId !== signedInUserId) {
                    discardSignupDraft()
                    restoredDraft.current = null
                    resetSetupFlow()
                } else if (draft?.userId === signedInUserId && signedInUserId) {
                    bindSignupDraft(signedInUserId)
                }
                if (signedInUserId) void flushPendingSignupAnswers(signedInUserId)
            }
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
            /*
             * A reload mid-signup (a deploy's service worker, chunk recovery,
             * pull to refresh) or an app restart lands here signed in without
             * the wallet the last step creates. Leaving for /home skipped the
             * email and every other step after registration, so every exit
             * below resumes instead. Entry never trusts a reloaded ?screen=:
             * it continues at the step saved on this device (signup-progress),
             * else at the first step after registration.
             */
            const resume = !isDemoMode() && unfinishedSignupRoute(user) === '/setup'
            if (resume) resumeSignup.current = true
            const exitSignedIn = () => {
                if (!resume) {
                    router.replace(signedInExit)
                    return
                }
                if (resolvedEntry.current === null || shownPostRegistration.current) return
                setScreenIdRef.current(resumeTargetRef.current(), { history: 'replace' })
            }
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
                            exitSignedIn()
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
                exitSignedIn()
                return
            }
            if (!isInitialSessionCheck) return
            if (resume) {
                exitSignedIn()
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
        profileFetchFailed,
        user,
        router,
        fetchUser,
        urlBadgeCampaigns,
        deepLinkGeneration,
        searchParamsString,
        draftReady,
        registrationInProgress,
        signedInUserId,
        resetSetupFlow,
    ])

    useEffect(() => {
        let cancelled = false
        const isObsolete = () => cancelled || initializationExpired.current
        const determineInitialStep = async () => {
            if (profileFetchFailed) return
            const entryKey = JSON.stringify([inviteCodeParam, legacyStepParam])
            if (isObsolete() || resolvedEntry.current === entryKey) return
            // wait for layout to populate steps after logout/mount
            if (!steps || steps.length === 0) {
                console.log('[SetupPage] waiting for steps to be initialized by layout...')
                setIsLoading(true)
                return
            }
            if (!draftReady) return

            setIsLoading(true)
            await new Promise((resolve) => setTimeout(resolve, 100)) // ensure other initializations can complete
            if (isObsolete()) return
            const entryScreen = (target: ScreenId): ScreenId => {
                if (!resumeSignup.current) return target
                const current = currentScreenRef.current
                if (shownPostRegistration.current && current) return current
                return resumeTargetRef.current()
            }
            const draft = restoredDraft.current

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
            // Web signup is closed (Landing hides Sign up), so the
            // ?step=signup / invite-code jump must not skip
            // past the landing gate — otherwise claim/invite links deep-link
            // straight into the signup form. Native app and support's keep-web
            // browsers keep the fast path.
            // The link's own visit counts: its cookie is saved after this entry resolves.
            const webSignupClosed = !isCapacitor() && !hasKeepWebCookie() && !isKeepWebLink(keepWebParam)
            const entryInput = {
                hasInviteCode: !!userInviteCode,
                stepParam: legacyStepParam,
                webSignupClosed,
                knownDevice: hasKnownDeviceCredentials(),
                screenIds: steps.map((entry) => entry.screenId),
            }

            // Web signup is a product-access decision, not a capability check:
            // every browser reaches Landing's Log In and store actions, and native
            // handles passkeys itself. replace, not push: the entry step overwrites
            // any stale ?screen= from a reload or shared link — the URL is only the
            // source of truth for IN-FLOW navigation (TASK-21460)
            const anonymousTarget =
                draft &&
                !signedInUserId &&
                !entryInput.webSignupClosed &&
                !entryInput.knownDevice &&
                legacyStepParam !== 'login' &&
                steps.some((entry) => entry.screenId === draft.screenId)
                    ? draft.screenId
                    : resolveSetupEntryStep(entryInput)
            const targetStep = entryScreen(anonymousTarget)
            if (!steps.some((s) => s.screenId === targetStep)) throw new Error('Setup entry step is missing')
            resolvedEntry.current = entryKey
            setScreenIdRef.current(targetStep, { history: 'replace' })
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
    }, [
        steps,
        inviteCodeParam,
        legacyStepParam,
        keepWebParam,
        profileFetchFailed,
        initializationAttempt,
        draftReady,
        signedInUserId,
    ])

    if (recoveryReason) {
        return (
            <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 p-6">
                <h1 className="text-center text-heading-m">{tCommon('somethingWentWrong')}</h1>
                <p className="text-center">{tCommon('genericError')}</p>
                <div className="flex w-full max-w-sm flex-col gap-3">
                    <Button
                        onClick={() => {
                            trackErrorScreen('try_again', 'tap', recoveryReason)
                            if (profileFetchFailed) {
                                void fetchUser().catch(() => {})
                                return
                            }
                            window.location.reload()
                        }}
                        disabled={isFetchingUser}
                    >
                        {tCommon('tryAgain')}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            trackErrorScreen('contact_support', 'tap', recoveryReason)
                            setIsSupportModalOpen(true)
                        }}
                    >
                        {tCommon('contactSupport')}
                    </Button>
                </div>
            </div>
        )
    }

    if (
        isLoading ||
        !sessionChecked ||
        isLeavingForHome ||
        isSettlingNativeBadgeCampaigns ||
        retryingInitialization ||
        isFetchingUser
    )
        return (
            <div className="flex h-dvh w-full flex-col items-center justify-center">
                <Loading variant="mascot" />
            </div>
        )

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

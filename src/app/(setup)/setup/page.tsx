'use client'

import Loading from '@/components/Global/Loading'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { type BeforeInstallPromptEvent, type ScreenId, type ISetupStep } from '@/components/Setup/Setup.types'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useSetupStepUrlSync } from '@/hooks/useSetupStepUrlSync'
import { useSetupBackHandler } from '@/hooks/useSetupBackHandler'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { Suspense, useEffect, useRef, useState } from 'react'
import { setupSteps as masterSetupSteps } from '../../../components/Setup/Setup.consts'
import { hasKnownDeviceCredentials, resolveSetupEntryStep } from '@/components/Setup/setup-entry'
import UnsupportedBrowserModal from '@/components/Global/UnsupportedBrowserModal'
import { isLikelyWebview, isDeviceOsSupported } from '@/components/Setup/Setup.utils'
import { isCapacitor } from '@/utils/capacitor'
import { isPwaSunsetOn } from '@/utils/migration.utils'
import { getFromCookie, saveToCookie, toInviteCode } from '@/utils/general.utils'
import { useSearchParams } from 'next/navigation'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { useAuth } from '@/context/authContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { PeanutWavingHello } from '@/assets/mascot'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useTranslations } from 'next-intl'
import { useModalsContext } from '@/context/ModalsContext'
import * as Sentry from '@sentry/nextjs'

function SetupPageContent() {
    const t = useTranslations('setup')
    const tCommon = useTranslations('common')
    const { setIsSupportModalOpen } = useModalsContext()
    const { steps, inviteCode } = useSetupStore()
    const { step, handleNext, handleBack, setScreenId } = useSetupFlow()
    const { logoutUser, isLoggingOut, user, isFetchingUser } = useAuth()
    const router = useRouter()
    const [direction, setDirection] = useState(0)
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [canInstall, setCanInstall] = useState(false)
    const [deviceType, setDeviceType] = useState<DeviceType>(DeviceType.WEB)
    const dispatch = useAppDispatch()
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
    // object: the step-URL mirror rewrites ?screen= on every step, and a dep
    // on the object identity would re-run determineInitialStep mid-flow and
    // bounce the user back to the entry step.
    const inviteCodeParam = searchParams.get('code')
    const legacyStepParam = searchParams.get('step')
    const [sessionChecked, setSessionChecked] = useState(false)
    const [existingSessionUsername, setExistingSessionUsername] = useState<string | null>(null)
    const recoveryReason =
        initializationError ??
        (!isLoading &&
        sessionChecked &&
        !step &&
        !existingSessionUsername &&
        !showDeviceNotSupportedModal &&
        !showBrowserNotSupportedModal
            ? 'missing_step'
            : null)

    useEffect(() => {
        if (recoveryReason) {
            Sentry.captureMessage('Setup recovery required', {
                level: 'warning',
                tags: { reason: recoveryReason },
            })
        }
    }, [recoveryReason])

    useEffect(() => {
        if ((!isLoading && sessionChecked) || initializationError) return
        const timeout = setTimeout(() => {
            initializationExpired.current = true
            setInitializationError('initialization_timeout')
        }, 15000)
        return () => clearTimeout(timeout)
    }, [isLoading, sessionChecked, initializationError])

    // only mirror steps that actually render: not while the entry step is
    // being determined, and not behind the existing-session interstitial
    // or the unsupported-device/browser modals
    const stepRendered =
        !!step &&
        !recoveryReason &&
        !isLoading &&
        sessionChecked &&
        !existingSessionUsername &&
        !showDeviceNotSupportedModal &&
        !showBrowserNotSupportedModal

    useSetupStepUrlSync({
        enabled: stepRendered,
        step,
        steps,
        goToScreen: setScreenId,
    })
    useSetupBackHandler({ step, canStepBack: stepRendered, onBack: handleBack })

    /*
     * A device can arrive at /setup already authenticated: a half-completed
     * earlier signup leaves durable credentials (jwt cookie in the native jar,
     * web-authn-key cookie), and running signup on top of them silently no-ops
     * — the passkey step would skip and the freshly chosen username would be
     * discarded. Check once, at entry only: `sessionChecked` stays true for the
     * rest of the flow, so the user becoming authenticated mid-signup (after
     * registration) never re-triggers the prompt.
     */
    useEffect(() => {
        if (sessionChecked || isFetchingUser) return
        setSessionChecked(true)
        if (user?.user?.username) {
            /*
             * A COMPLETED session (hasAppAccess) that lands back on /setup — e.g. a
             * native cold start that restored this route — goes straight home; the
             * interstitial is reserved for the half-finished-signup case it was
             * written for (durable credentials, setup never completed).
             */
            if (user.user.hasAppAccess) {
                posthog.capture(ANALYTICS_EVENTS.SIGNUP_EXISTING_SESSION_CONTINUED, { auto: true })
                router.replace('/home')
                return
            }
            setExistingSessionUsername(user.user.username)
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_EXISTING_SESSION_PROMPTED, {
                has_app_access: !!user.user.hasAppAccess,
            })
        }
    }, [sessionChecked, isFetchingUser, user, router])

    const handleContinueSession = () => {
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_EXISTING_SESSION_CONTINUED)
        // Mounting the (setup) layout armed the post-setup iOS install wall
        // (setShowIosPwaInstallScreen in (setup)/layout.tsx). This visit was not a
        // setup session and the soft nav keeps the store alive, so disarm it —
        // otherwise /home renders the no-escape ForceIOSPWAInstall screen.
        dispatch(setupActions.setShowIosPwaInstallScreen(false))
        router.push('/home')
    }

    const handleStartFresh = async () => {
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_EXISTING_SESSION_LOGGED_OUT)
        await logoutUser()
        setExistingSessionUsername(null)
    }

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

            // The entry-step rules (invite code / ?step=signup skipping the invite
            // gate, ?step=login, a known device going to Log In) live in
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
             * as the same session cookie the web InvitesPage and the
             * deferred-install hand-off write, so it survives the multi-step
             * signup and reaches registration.
             */
            const codeFromUrl = inviteCodeParam
            if (codeFromUrl && toInviteCode(codeFromUrl)) {
                saveToCookie('inviteCode', toInviteCode(codeFromUrl))
            }
            const inviteCodeFromCookie = getFromCookie('inviteCode')
            const userInviteCode = inviteCode || inviteCodeFromCookie
            // pwa-sunset notice window: web signups are closed (Landing hides
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

            // in capacitor, passkeys are handled natively — skip all browser/webview/os/pwa checks
            // and go straight to the landing (signup) flow
            if (isCapacitor()) {
                setDeviceType(localDeviceType)
                const targetStep = resolveSetupEntryStep({
                    ...entryInput,
                    isCapacitor: true,
                    deviceType: localDeviceType,
                    isStandalonePWA: false,
                })
                const stepIndex = steps.findIndex((s: ISetupStep) => s.screenId === targetStep)
                if (stepIndex === -1) throw new Error('Setup entry step is missing')
                dispatch(setupActions.setStep(stepIndex + 1))
                setIsLoading(false)
                return
            }

            // check if device has a platform authenticator (biometric/pin).
            // capacitor already returned above — this only runs on web.
            let passkeySupport = true
            try {
                if (PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
                    passkeySupport = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                }
            } catch (e) {
                passkeySupport = false
                console.error('Error checking passkey support:', e)
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

            const unsupportedBrowserStepExists = masterSetupSteps.find(
                (s: ISetupStep) => s.screenId === 'unsupported-browser'
            )
            let determinedSetupInitialStepId: ScreenId | undefined = undefined

            // main decision logic for showing modals or proceeding with setup
            if (effectiveCurrentlyInWebview) {
                // if in a webview and passkeys aren't supported (and the unsupported browser step is defined),
                // show the unsupported browser modal
                if (!passkeySupport && unsupportedBrowserStepExists) {
                    setShowBrowserNotSupportedModal(true)
                    setIsLoading(false)
                    setDeviceType(localDeviceType)
                    return
                }
            } else {
                // not in an effective webview
                if (!osSupportedByVersion) {
                    // if os version is too old, show device not supported modal
                    setShowDeviceNotSupportedModal(true)
                    setIsLoading(false)
                    setDeviceType(localDeviceType)
                    return
                } else if (!passkeySupport) {
                    // if os is fine but passkeys are still not supported (e.g., old browser on supported os),
                    // show device not supported modal
                    setShowDeviceNotSupportedModal(true)
                    setIsLoading(false)
                    setDeviceType(localDeviceType)
                    return
                }
            }

            // if no modal was triggered, proceed to determine actual setup step
            setDeviceType(localDeviceType)

            const isStandalonePWA =
                typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches

            if (localDeviceType === 'android' && !isStandalonePWA) {
                setCanInstall(true)
                setDeferredPrompt({} as BeforeInstallPromptEvent)
            }

            determinedSetupInitialStepId = resolveSetupEntryStep({
                ...entryInput,
                isCapacitor: false,
                deviceType: localDeviceType,
                isStandalonePWA,
            })

            const initialStepIndex = steps.findIndex((s: ISetupStep) => s.screenId === determinedSetupInitialStepId)
            if (initialStepIndex === -1) throw new Error('Setup entry step is missing')
            dispatch(setupActions.setStep(initialStepIndex + 1))

            setIsLoading(false)
        }

        void determineInitialStep().catch(() => {
            if (isObsolete()) return
            setInitializationError('initialization_failed')
            setIsLoading(false)
        })

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            setCanInstall(true)
        }
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

        return () => {
            cancelled = true
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        }
    }, [dispatch, steps, inviteCodeParam, legacyStepParam])

    useEffect(() => {
        if (step) {
            const newIndex = steps.findIndex((s: ISetupStep) => s.screenId === step.screenId)
            setDirection(newIndex > currentStepIndex ? 1 : -1)
            setCurrentStepIndex(newIndex)
        }
    }, [step, currentStepIndex, steps])

    if (recoveryReason) {
        return (
            <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 p-6">
                <h1 className="text-heading-2 text-center">{tCommon('somethingWentWrong')}</h1>
                <p className="text-center">{tCommon('genericError')}</p>
                <div className="flex w-full max-w-sm flex-col gap-3">
                    <Button onClick={() => window.location.reload()}>{tCommon('tryAgain')}</Button>
                    <Button variant="stroke" onClick={() => setIsSupportModalOpen(true)}>
                        {tCommon('contactSupport')}
                    </Button>
                </div>
            </div>
        )
    }

    if (isLoading || !sessionChecked)
        return (
            <div className="flex h-dvh w-full flex-col items-center justify-center">
                <Loading variant="mascot" />
            </div>
        )

    if (existingSessionUsername) {
        return (
            <SetupWrapper
                layoutType="signup"
                screenId="welcome"
                image={PeanutWavingHello.src}
                title={t('existingSession.title')}
                description={t('existingSession.description', { username: existingSessionUsername })}
                contentClassName="flex flex-col items-center justify-center gap-6"
            >
                <div className="flex w-full flex-col gap-3">
                    <Button shadowSize="4" onClick={handleContinueSession} disabled={isLoggingOut}>
                        {t('existingSession.continueAs', { username: existingSessionUsername })}
                    </Button>
                    <Button variant="stroke" onClick={handleStartFresh} loading={isLoggingOut} disabled={isLoggingOut}>
                        {t('existingSession.logoutAndStartFresh')}
                    </Button>
                </div>
            </SetupWrapper>
        )
    }

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
            showLoginButton={step.showLoginButton}
            imageClassName={step.imageClassName}
            onBack={handleBack}
            onSkip={() => handleNext()}
            onLogout={logoutUser}
            isLoggingOut={isLoggingOut}
            step={currentStepIndex}
            direction={direction}
            deferredPrompt={deferredPrompt}
            canInstall={canInstall}
            deviceType={deviceType}
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

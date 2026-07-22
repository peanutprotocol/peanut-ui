'use client'

import PeanutLoading from '@/components/Global/PeanutLoading'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { type BeforeInstallPromptEvent, type ScreenId, type ISetupStep } from '@/components/Setup/Setup.types'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { Suspense, useEffect, useState } from 'react'
import { setupSteps as masterSetupSteps } from '../../../components/Setup/Setup.consts'
import UnsupportedBrowserModal from '@/components/Global/UnsupportedBrowserModal'
import { isLikelyWebview, isDeviceOsSupported } from '@/components/Setup/Setup.utils'
import { isCapacitor } from '@/utils/capacitor'
import { getFromCookie } from '@/utils/general.utils'
import { useSearchParams } from 'next/navigation'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useAuth } from '@/context/authContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { PeanutWavingHello } from '@/assets/mascot'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useTranslations } from 'next-intl'

function SetupPageContent() {
    const t = useTranslations('setup')
    const { steps, inviteCode } = useSetupStore()
    const { step, handleNext, handleBack } = useSetupFlow()
    const { logoutUser, isLoggingOut, user, isFetchingUser } = useAuth()
    const router = useRouter()
    const [direction, setDirection] = useState(0)
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [canInstall, setCanInstall] = useState(false)
    const [deviceType, setDeviceType] = useState<DeviceType>(DeviceType.WEB)
    const dispatch = useAppDispatch()
    const [isLoading, setIsLoading] = useState(true)
    const [showDeviceNotSupportedModal, setShowDeviceNotSupportedModal] = useState(false)
    const [showBrowserNotSupportedModal, setShowBrowserNotSupportedModal] = useState(false)
    const { deviceType: detectedDeviceType } = useDeviceType()
    const searchParams = useSearchParams()
    const [sessionChecked, setSessionChecked] = useState(false)
    const [existingSessionUsername, setExistingSessionUsername] = useState<string | null>(null)

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
            setExistingSessionUsername(user.user.username)
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_EXISTING_SESSION_PROMPTED, {
                has_app_access: !!user.user.hasAppAccess,
            })
        }
    }, [sessionChecked, isFetchingUser, user])

    const handleContinueSession = () => {
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_EXISTING_SESSION_CONTINUED)
        router.push('/home')
    }

    const handleStartFresh = async () => {
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_EXISTING_SESSION_LOGGED_OUT)
        await logoutUser()
        setExistingSessionUsername(null)
    }

    useEffect(() => {
        const determineInitialStep = async () => {
            // wait for layout to populate steps after logout/mount
            if (!steps || steps.length === 0) {
                console.log('[SetupPage] waiting for steps to be initialized by layout...')
                setIsLoading(true)
                return
            }

            setIsLoading(true)
            await new Promise((resolve) => setTimeout(resolve, 100)) // ensure other initializations can complete

            // Skip the invite-code gate straight to signup when either:
            //  - an invite code is present (cookie survives the PWA-install hop), or
            //  - the URL asks for it via ?step=signup — the signal every campaign /
            //    skip flow already sends (ShhhhhLandingPage, InvitesPage.handleClaim)
            //    when it pushes to /setup. useZeroDev still reads the campaignTag
            //    cookie post-signup to award the badge; the step decision no longer
            //    trusts that cookie.
            //
            // Why not the campaignTag cookie: it's a session cookie cleared only on a
            // successful signup, so a returning user who claimed a campaign earlier in
            // the same session was routed past Landing (the only screen with Log In)
            // onto Signup, unable to log back in (regression from PR #2346).
            const inviteCodeFromCookie = getFromCookie('inviteCode')
            const userInviteCode = inviteCode || inviteCodeFromCookie
            const skipInviteGate = !!userInviteCode || searchParams.get('step') === 'signup'

            const localDeviceType = detectedDeviceType

            // in capacitor, passkeys are handled natively — skip all browser/webview/os/pwa checks
            // and go straight to the landing (signup) flow
            if (isCapacitor()) {
                setDeviceType(localDeviceType)
                // invite code or ?step=signup → straight to signup, else landing
                const targetStep = skipInviteGate ? 'signup' : 'landing'
                const stepIndex = steps.findIndex((s: ISetupStep) => s.screenId === targetStep)
                if (stepIndex !== -1) {
                    dispatch(setupActions.setStep(stepIndex + 1))
                }
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

            if (localDeviceType === 'android') {
                determinedSetupInitialStepId = isStandalonePWA ? 'landing' : 'android-initial-pwa-install'
            }
            // if ios, show landing screen
            else if (localDeviceType === 'ios') {
                determinedSetupInitialStepId = 'landing'
            } else {
                determinedSetupInitialStepId = 'pwa-install'
            }

            // If an invite code or ?step=signup is present, jump to signup
            if (determinedSetupInitialStepId && skipInviteGate) {
                const signupScreenIndex = steps.findIndex((s: ISetupStep) => s.screenId === 'signup')
                dispatch(setupActions.setStep(signupScreenIndex + 1))
            } else if (determinedSetupInitialStepId) {
                const initialStepIndex = steps.findIndex((s: ISetupStep) => s.screenId === determinedSetupInitialStepId)
                if (initialStepIndex !== -1) {
                    dispatch(setupActions.setStep(initialStepIndex + 1))
                } else {
                    console.warn(
                        `Could not find step index for screenId: ${determinedSetupInitialStepId}. Defaulting to step 1.`
                    )
                    dispatch(setupActions.setStep(1))
                }
            } else {
                console.warn('No specific initial step ID determined. Defaulting to step 1.')
                dispatch(setupActions.setStep(1))
            }

            setIsLoading(false)
        }

        determineInitialStep()

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            setCanInstall(true)
        }
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        }
    }, [dispatch, steps, searchParams])

    useEffect(() => {
        if (step) {
            const newIndex = steps.findIndex((s: ISetupStep) => s.screenId === step.screenId)
            setDirection(newIndex > currentStepIndex ? 1 : -1)
            setCurrentStepIndex(newIndex)
        }
    }, [step, currentStepIndex, steps])

    if (isLoading || !sessionChecked)
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                <PeanutLoading />
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
                contentClassName="flex flex-col items-center justify-center gap-5"
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

    // if no step is determined and no blocking modal is shown, it's an issue
    if (!step && !showDeviceNotSupportedModal && !showBrowserNotSupportedModal) {
        console.warn('SetupPage: No current step found, and no blocking modal. Possibly init issue.')
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                <PeanutLoading />
            </div>
        )
    }

    if (showBrowserNotSupportedModal || showDeviceNotSupportedModal) {
        return <UnsupportedBrowserModal visible={true} allowClose={false} />
    }

    // fallback if step is still null after modal checks, though unlikely
    if (!step) {
        console.warn('SetupPage: No current step after modal checks.')
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                <PeanutLoading />
            </div>
        )
    }

    const titleKey = `steps.${step.screenId}.title` as Parameters<typeof t>[0]
    const descriptionKey = `steps.${step.screenId}.description` as Parameters<typeof t>[0]

    return (
        <SetupWrapper
            layoutType={step.layoutType}
            screenId={step.screenId}
            image={step.image}
            title={t(titleKey)}
            description={t.has(descriptionKey) ? t(descriptionKey) : undefined}
            showBackButton={step.showBackButton}
            showSkipButton={step.showSkipButton}
            showLogoutButton={step.screenId === 'sign-test-transaction'}
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
        <Suspense fallback={<PeanutLoading coverFullScreen />}>
            <SetupPageContent />
        </Suspense>
    )
}

'use client'

import PeanutLoading from '@/components/Global/PeanutLoading'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { BeforeInstallPromptEvent, ScreenId, ISetupStep } from '@/components/Setup/Setup.types'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useEffect, useState } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import { IconName } from '@/components/Global/Icons/Icon'
import { setupSteps as masterSetupSteps } from '../../../components/Setup/Setup.consts'
import UnsupportedBrowserModal, { inAppSignatures } from '@/components/Global/UnsupportedBrowserModal'

// webview check
const isLikelyWebview = () => {
    if (typeof navigator === 'undefined') return false
    const uaString = navigator.userAgent || navigator.vendor || (window as any).opera
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
        return false
    }
    return inAppSignatures.some((sig) => new RegExp(sig, 'i').test(uaString))
}

const isDeviceOsSupported = (ua: string): boolean => {
    if (!ua) return true
    const androidMatch = ua.match(/Android\s+(\d+)(?:\.(\d+))?(?:\.(\d+))?/i)
    if (androidMatch) {
        const majorVersion = parseInt(androidMatch[1], 10)
        return majorVersion >= 9
    }
    const iosMatch = ua.match(/(?:CPU OS|iPhone OS|iPad; CPU OS)\s+(\d+)(?:_(\d+))?(?:_(\d+))?/i)
    if (iosMatch) {
        const majorVersion = parseInt(iosMatch[1], 10)
        return majorVersion >= 16
    }
    return true
}

const getDeviceTypeForLogic = (ua: string): 'ios' | 'android' | 'desktop' => {
    if (!ua) return 'desktop'
    const isIOS =
        /iPad|iPhone|iPod/.test(ua) ||
        (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isAndroid = /Android/i.test(ua)
    if (isIOS) return 'ios'
    if (isAndroid) return 'android'
    return 'desktop'
}

export default function SetupPage() {
    const { steps } = useSetupStore()
    const { step, handleNext, handleBack } = useSetupFlow()
    const [direction, setDirection] = useState(0)
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [canInstall, setCanInstall] = useState(false)
    const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop')
    const dispatch = useAppDispatch()
    const [isLoading, setIsLoading] = useState(true)
    const [showDeviceNotSupportedModal, setShowDeviceNotSupportedModal] = useState(false)
    const [showBrowserNotSupportedModal, setShowBrowserNotSupportedModal] = useState(false)

    useEffect(() => {
        setIsLoading(true)

        const determineInitialStep = async () => {
            if (!steps || steps.length === 0) {
                console.warn('determineInitialStep: Redux steps not yet loaded. Will retry when steps update.')
                setIsLoading(false) // Prevent infinite loading if steps never arrive
                return
            }
            await new Promise((resolve) => setTimeout(resolve, 100))

            let passkeySupport = true
            try {
                passkeySupport = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            } catch (e) {
                passkeySupport = false
                console.error('Error checking passkey support:', e)
            }

            const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
            const localDeviceType = getDeviceTypeForLogic(ua)
            const osSupportedByVersion = isDeviceOsSupported(ua)
            const webviewByUASignature = isLikelyWebview() // Uses inAppSignatures

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

            if (effectiveCurrentlyInWebview) {
                if (!passkeySupport && unsupportedBrowserStepExists) {
                    setShowBrowserNotSupportedModal(true)
                    setIsLoading(false)
                    // Set deviceType state here if needed for the browser modal's debug info, though it's less critical there
                    setDeviceType(localDeviceType)
                    return
                }
            } else {
                // Not in an effective webview
                if (!osSupportedByVersion) {
                    setShowDeviceNotSupportedModal(true)
                    setIsLoading(false)
                    setDeviceType(localDeviceType) // Set for modal debug
                    return
                } else if (!passkeySupport) {
                    // OS is supported, but general passkey check fails
                    setShowDeviceNotSupportedModal(true)
                    setIsLoading(false)
                    setDeviceType(localDeviceType) // Set for modal debug
                    return
                }
            }

            // If no modal was triggered, proceed to determine actual setup step and set deviceType state
            setDeviceType(localDeviceType)

            const isStandalonePWA =
                typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches

            if (localDeviceType === 'android' && !isStandalonePWA) {
                setCanInstall(true)
                setDeferredPrompt({} as BeforeInstallPromptEvent) // Simplified
            }

            if (localDeviceType === 'android') {
                determinedSetupInitialStepId = isStandalonePWA ? 'welcome' : 'android-initial-pwa-install'
            } else if (localDeviceType === 'ios') {
                determinedSetupInitialStepId = 'welcome'
            } else {
                determinedSetupInitialStepId = 'pwa-install'
            }

            if (determinedSetupInitialStepId) {
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
    }, [dispatch, steps])

    useEffect(() => {
        if (step) {
            const newIndex = steps.findIndex((s: ISetupStep) => s.screenId === step.screenId)
            setDirection(newIndex > currentStepIndex ? 1 : -1)
            setCurrentStepIndex(newIndex)
        }
    }, [step, currentStepIndex, steps])

    if (isLoading)
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                <PeanutLoading />
            </div>
        )

    if (!step && !showDeviceNotSupportedModal && !showBrowserNotSupportedModal) {
        // Added modal checks
        console.warn('SetupPage: No current step found, and no blocking modal. Possibly init issue.')
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                <PeanutLoading />
            </div>
        )
    }

    // For debug display in modals, we use current state or re-evaluate.
    // The `deviceType` state might not be updated if modal is shown before setDeviceType call completes a render cycle.
    // However, `localDeviceType` was set in the paths leading to modals in `determineInitialStep`.
    // The user's current placement of debug string construction needs to be respected.

    const uaForDebug = typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'
    const displayCurrentlyInWebviewForDebug = isLikelyWebview()
    const displayIsOsSupportedForDebug = isDeviceOsSupported(uaForDebug)
    const displayDeviceTypeForDebug = deviceType // Uses current state, might be 'desktop' if modal shown early.
    // More accurate would be to pass localDeviceType if modal is shown

    const displayUnsupportedBrowserStepExistsForDebug = masterSetupSteps.find(
        (s: ISetupStep) => s.screenId === 'unsupported-browser'
    )
        ? 'Exists'
        : 'Missing'

    const browserModalDebugDescription = `Debug Info: In Webview: ${displayCurrentlyInWebviewForDebug}, Unsupported Step: ${displayUnsupportedBrowserStepExistsForDebug}. UA: ${uaForDebug}. This modal is shown because passkey support was likely unavailable in this webview context.`

    if (showDeviceNotSupportedModal) {
        // To ensure the deviceType in this specific modal's debug is accurate for the check that triggered it,
        // we should use the deviceType determined at that point. Since it's complex to pass it down directly here
        // without further refactoring, the state `deviceType` will be used, which is now set before early returns.
        return (
            <ActionModal
                visible={true}
                onClose={() => {}}
                title="Device not supported!"
                description={`Debug Info: OS Supported: ${displayIsOsSupportedForDebug}, In Webview: ${displayCurrentlyInWebviewForDebug}, Device Type: ${displayDeviceTypeForDebug}. Passkey check failed in this context. UA: ${uaForDebug}. FOR unsupported-browser modal, see below.\n${browserModalDebugDescription}`}
                icon={'alert' as IconName}
                preventClose={true}
                hideModalCloseButton={true}
                ctas={[]}
            />
        )
    }

    if (showBrowserNotSupportedModal) {
        // If this modal is shown, effectiveCurrentlyInWebview was true.
        // The descriptionOverride was removed by user, so this will use its default.
        // For debugging, they are looking at the DeviceNotSupportedModal which now includes browser modal info.
        return <UnsupportedBrowserModal visible={true} allowClose={false} />
    }

    if (!step) {
        // Fallback if step is still null after modals are checked
        console.warn('SetupPage: No current step after modal checks.')
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                <PeanutLoading />
            </div>
        )
    }

    return (
        <SetupWrapper
            layoutType={step.layoutType}
            screenId={step.screenId}
            image={step.image}
            title={step.title}
            description={step.description}
            showBackButton={step.showBackButton}
            showSkipButton={step.showSkipButton}
            imageClassName={step.imageClassName}
            onBack={handleBack}
            onSkip={() => handleNext()}
            step={currentStepIndex}
            direction={direction}
            deferredPrompt={deferredPrompt}
            canInstall={canInstall}
            deviceType={deviceType} // Uses the state variable `deviceType`
            titleClassName={step.titleClassName}
            contentClassName={step.contentClassName}
        >
            <step.component />
        </SetupWrapper>
    )
}

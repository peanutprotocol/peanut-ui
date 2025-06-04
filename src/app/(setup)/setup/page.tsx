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
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
        return false
    }
    return inAppSignatures.some((sig) => new RegExp(sig, 'i').test(ua))
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

            const currentlyInWebview = isLikelyWebview()
            let initialStepId: ScreenId | undefined = undefined
            const unsupportedBrowserStepExists = masterSetupSteps.find(
                (s: ISetupStep) => s.screenId === 'unsupported-browser'
            )

            if (currentlyInWebview) {
                if (!passkeySupport && unsupportedBrowserStepExists) {
                    initialStepId = 'unsupported-browser'
                    setShowBrowserNotSupportedModal(true)
                }
            } else {
                if (!passkeySupport) {
                    if (unsupportedBrowserStepExists) {
                        initialStepId = 'unsupported-browser'
                        setShowBrowserNotSupportedModal(true)
                    } else {
                        setShowDeviceNotSupportedModal(true)
                        setIsLoading(false)
                        return
                    }
                }
            }

            if (initialStepId === undefined) {
                const userAgent = navigator.userAgent
                const isIOSDevice =
                    /iPad|iPhone|iPod/.test(userAgent) ||
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
                const isAndroidDevice = /Android/i.test(userAgent)
                const isStandalonePWA =
                    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches

                let currentDeviceType: 'ios' | 'android' | 'desktop' = 'desktop'
                if (isIOSDevice) currentDeviceType = 'ios'
                else if (isAndroidDevice) currentDeviceType = 'android'
                setDeviceType(currentDeviceType)

                if (currentDeviceType === 'android' && !isStandalonePWA) {
                    setCanInstall(true)
                    setDeferredPrompt({
                        prompt: async () => {
                            return Promise.resolve()
                        },
                        userChoice: new Promise((resolve) => {
                            setTimeout(() => {
                                resolve({ outcome: 'accepted', platform: 'web' })
                            }, 500)
                        }),
                        platforms: ['web'],
                    } as BeforeInstallPromptEvent)
                }

                if (currentDeviceType === 'android') {
                    initialStepId = isStandalonePWA ? 'welcome' : 'android-initial-pwa-install'
                } else if (currentDeviceType === 'ios') {
                    initialStepId = 'welcome'
                } else {
                    initialStepId = 'pwa-install'
                }
            }

            if (initialStepId) {
                const initialStepIndex = steps.findIndex((s: ISetupStep) => s.screenId === initialStepId)
                if (initialStepIndex !== -1) {
                    dispatch(setupActions.setStep(initialStepIndex + 1))
                } else {
                    console.warn(
                        `Could not find step index in Redux steps for screenId: ${initialStepId}. Defaulting to step 1.`
                    )
                    dispatch(setupActions.setStep(1))
                }
            } else if (!showDeviceNotSupportedModal) {
                console.warn('Initial step ID was not determined, no modal shown. Defaulting to step 1.')
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

    if (!step) {
        console.warn('SetupPage: No current step found, possibly due to empty Redux steps or initialization issue.')
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                <PeanutLoading />
            </div>
        )
    }

    if (showDeviceNotSupportedModal) {
        return (
            <ActionModal
                visible={true}
                onClose={() => {}}
                title="Device not supported!"
                description="This device doesn't support some of the technologies Peanut needs to work properly. Please try opening this link on a newer phone."
                icon={'alert' as IconName}
                preventClose={true}
                hideModalCloseButton={true}
                ctas={[]}
            />
        )
    }

    if (showBrowserNotSupportedModal) {
        return <UnsupportedBrowserModal visible={true} allowClose={false} />
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
            deviceType={deviceType}
            titleClassName={step.titleClassName}
            contentClassName={step.contentClassName}
        >
            <step.component />
        </SetupWrapper>
    )
}

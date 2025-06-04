'use client'

import PeanutLoading from '@/components/Global/PeanutLoading'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { BeforeInstallPromptEvent, ScreenId } from '@/components/Setup/Setup.types'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useEffect, useState } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import { IconName } from '@/components/Global/Icons/Icon'

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

    useEffect(() => {
        setIsLoading(true)

        const determineInitialStep = async () => {
            // add a small delay to allow browser state to settle after navigation
            await new Promise((resolve) => setTimeout(resolve, 100))

            let passkeySupport = true
            try {
                passkeySupport = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            } catch (e) {
                passkeySupport = false
                console.error('Error checking passkey support:', e)
            }

            let initialStepId: ScreenId | undefined = undefined
            const unsupportedBrowserStepExists = steps.find((s) => s.screenId === 'unsupported-browser')

            if (!passkeySupport) {
                if (unsupportedBrowserStepExists) {
                    initialStepId = 'unsupported-browser'
                } else {
                    setShowDeviceNotSupportedModal(true)
                    setIsLoading(false)
                    return
                }
            } else {
                const userAgent = navigator.userAgent
                const isIOSDevice =
                    /iPad|iPhone|iPod/.test(userAgent) ||
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
                const isAndroidDevice = /Android/i.test(userAgent)
                const isStandalonePWA =
                    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches

                let currentDeviceType: 'ios' | 'android' | 'desktop' = 'desktop'
                if (isIOSDevice) {
                    currentDeviceType = 'ios'
                } else if (isAndroidDevice) {
                    currentDeviceType = 'android'
                }
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
                    if (isStandalonePWA) {
                        initialStepId = 'welcome'
                    } else {
                        initialStepId = 'android-initial-pwa-install'
                    }
                } else if (currentDeviceType === 'ios') {
                    initialStepId = 'welcome'
                } else {
                    // desktop
                    initialStepId = 'pwa-install'
                }
            }

            if (initialStepId) {
                const initialStepIndex = steps.findIndex((s) => s.screenId === initialStepId)
                if (initialStepIndex !== -1) {
                    dispatch(setupActions.setStep(initialStepIndex + 1))
                } else {
                    console.warn(`Could not find step index for screenId: ${initialStepId}, defaulting to step 1.`)
                    dispatch(setupActions.setStep(1))
                }
            } else {
                if (!showDeviceNotSupportedModal) {
                    console.warn(
                        'Initial step ID was not determined and no device support modal shown, defaulting to step 1.'
                    )
                    dispatch(setupActions.setStep(1))
                }
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
            // determine direction based on new step index
            const newIndex = steps.findIndex((s) => s.screenId === step.screenId)
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

    // todo: add loading state
    if (!step) return null

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

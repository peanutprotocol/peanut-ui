'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { BeforeInstallPromptEvent, ScreenId } from '@/components/Setup/Setup.types'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useEffect, useState } from 'react'

export default function SetupPage() {
    const toast = useToast()
    const { steps } = useSetupStore()
    const { step, handleNext, handleBack } = useSetupFlow()
    const [direction, setDirection] = useState(0)
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [canInstall, setCanInstall] = useState(false)
    const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop')
    const dispatch = useAppDispatch()
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        setIsLoading(true)

        const determineInitialStep = async () => {
            let passkeySupport = true
            try {
                passkeySupport = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            } catch (e) {
                passkeySupport = false
                console.error('Error checking passkey support:', e)
            }

            let initialStepId: ScreenId
            const unsupportedBrowserStepExists = steps.find((s) => s.screenId === 'unsupported-browser')

            if (!passkeySupport && unsupportedBrowserStepExists) {
                initialStepId = 'unsupported-browser'
            } else {
                // detect device type only if passkeys are supported or unsupported-browser step doesn't exist
                const userAgent = navigator.userAgent
                const isIOSDevice =
                    /iPad|iPhone|iPod/.test(userAgent) ||
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
                const isAndroidDevice = /Android/i.test(userAgent)

                let currentDeviceType: 'ios' | 'android' | 'desktop' = 'desktop'
                if (isIOSDevice) {
                    currentDeviceType = 'ios'
                } else if (isAndroidDevice) {
                    currentDeviceType = 'android'
                }
                setDeviceType(currentDeviceType)

                if (currentDeviceType === 'android') {
                    setCanInstall(true)
                    setDeferredPrompt({
                        prompt: async () => {
                            setTimeout(() => {
                                window.dispatchEvent(new Event('appinstalled'))
                            }, 1500)
                            return Promise.resolve()
                        },
                        userChoice: new Promise((resolve) => {
                            setTimeout(() => {
                                resolve({ outcome: 'accepted', platform: 'web' })
                            }, 1000)
                        }),
                        platforms: ['web'],
                    } as BeforeInstallPromptEvent)
                }

                if (currentDeviceType === 'android') {
                    initialStepId = 'android-initial-pwa-install'
                } else if (currentDeviceType === 'ios') {
                    initialStepId = 'welcome'
                } else {
                    // esktop
                    initialStepId = 'pwa-install'
                }
            }

            const initialStepIndex = steps.findIndex((s) => s.screenId === initialStepId)
            if (initialStepIndex !== -1) {
                dispatch(setupActions.setStep(initialStepIndex + 1))
            } else {
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
        >
            <step.component />
        </SetupWrapper>
    )
}

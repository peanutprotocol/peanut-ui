'use client'

import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useSetupStore } from '@/redux/hooks'
import { useEffect, useState } from 'react'
import { BeforeInstallPromptEvent } from '@/components/Setup/Setup.types'

export default function SetupPage() {
    const { steps } = useSetupStore()
    const { step, handleNext, handleBack } = useSetupFlow()
    const [direction, setDirection] = useState(0)
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [canInstall, setCanInstall] = useState(false)
    const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop')

    useEffect(() => {
        // Store the install prompt
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault()
            console.log('beforeinstallprompt', e)
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            setCanInstall(true)
        }

        // Detect device type
        const isIOSDevice = /iPad|iPhone|iPod|Mac|Macintosh/.test(navigator.userAgent)
        const isMobileDevice = /Android|webOS|iPad|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        )

        // For desktop, default to iOS if on Mac, otherwise Android
        if (!isMobileDevice) {
            setDeviceType('desktop')
        } else {
            if (isIOSDevice) {
                setDeviceType('ios')
            } else {
                setDeviceType('android')
            }
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        }
    }, [])

    useEffect(() => {
        if (step) {
            // determine direction based on new step index
            const newIndex = steps.findIndex((s) => s.screenId === step.screenId)
            setDirection(newIndex > currentStepIndex ? 1 : -1)
            setCurrentStepIndex(newIndex)
        }
    }, [step, currentStepIndex])

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

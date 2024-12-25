'use client'

import { setupSteps } from '@/components/Setup/Setup.consts'
import { usePWAStatus } from '@/hooks/usePWAStatus'
import { useRouter } from 'next/navigation'
import { SetupFlowProvider } from '../../components/Setup/context/SetupFlowContext'
import '../../styles/globals.bruddle.css'

const SetupLayout = ({ children }: { children?: React.ReactNode }) => {
    const { push } = useRouter()
    const isPWA = usePWAStatus()

    return (
        <SetupFlowProvider
            steps={setupSteps.filter((step) => {
                // Remove pwa-install step if PWA is already installed
                return step.screenId !== 'pwa-install' || !isPWA
            })}
            onComplete={() => {
                push('/home')
            }}
        >
            {children}
        </SetupFlowProvider>
    )
}

export default SetupLayout

'use client'

import '../../styles/globals.bruddle.css'
import { useRouter } from 'next/navigation'
import { SetupFlowProvider } from '../../components/Setup/context/SetupFlowContext'
import { SETUP_STEPS } from '@/components/Setup/Setup.consts'
import { usePWAStatus } from '@/hooks/usePWAStatus'

const SetupLayout = ({ children }: { children?: React.ReactNode }) => {
    const { push } = useRouter()
    const isPWA = usePWAStatus()

    return (
        <SetupFlowProvider
            steps={SETUP_STEPS.filter((step) => {
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

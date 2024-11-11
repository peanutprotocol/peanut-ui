'use client'

import '../../styles/globals.bruddle.css'
import { useRouter } from 'next/navigation'
import { SetupFlowProvider } from '../../components/Setup/context/SetupFlowContext'
import { SETUP_STEPS } from '@/components/Setup/Setup.consts'

const SetupLayout = ({ children }: { children?: React.ReactNode }) => {
    const { push } = useRouter()

    return (
        <div className="h-screen">
            <SetupFlowProvider
                steps={SETUP_STEPS}
                onComplete={() => {
                    push('/home')
                }}
            >
                {children}
            </SetupFlowProvider>
        </div>
    )
}

export default SetupLayout

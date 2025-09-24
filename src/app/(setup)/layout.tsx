'use client'

import { usePWAStatus } from '@/hooks/usePWAStatus'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useEffect } from 'react'
import { setupSteps } from '../../components/Setup/Setup.consts'
import '../../styles/globals.css'
import { useSearchParams } from 'next/navigation'

const SetupLayout = ({ children }: { children?: React.ReactNode }) => {
    const dispatch = useAppDispatch()
    const isPWA = usePWAStatus()
    const searchParams = useSearchParams()
    const selectedStep = searchParams.get('step')

    useEffect(() => {
        // filter steps and set them in redux state
        const filteredSteps = setupSteps.filter((step) => {
            if (selectedStep === 'signup' && step.screenId === 'welcome') {
                return false
            }
            return step.screenId !== 'pwa-install' || !isPWA
        })
        dispatch(setupActions.setSteps(filteredSteps))
    }, [isPWA])

    return <>{children}</>
}

export default SetupLayout

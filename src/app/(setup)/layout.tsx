'use client'

import { usePWAStatus } from '@/hooks/usePWAStatus'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useEffect } from 'react'
import { setupSteps } from '../../components/Setup/Setup.consts'
import '../../styles/globals.css'
import UnsupportedBrowserModal from '@/components/Global/UnsupportedBrowserModal'

const SetupLayout = ({ children }: { children?: React.ReactNode }) => {
    const dispatch = useAppDispatch()
    const isPWA = usePWAStatus()

    useEffect(() => {
        // filter steps and set them in redux state
        const filteredSteps = setupSteps.filter((step) => {
            return step.screenId !== 'pwa-install' || !isPWA
        })
        dispatch(setupActions.setSteps(filteredSteps))
    }, [isPWA])

    return (
        <>
            <UnsupportedBrowserModal allowClose={false} />
            {children}
        </>
    )
}

export default SetupLayout

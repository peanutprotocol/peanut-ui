'use client'

import { usePWAStatus } from '@/hooks/usePWAStatus'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useEffect, Suspense } from 'react'
import { setupSteps } from '../../components/Setup/Setup.consts'
import '../../styles/globals.css'
import { useSearchParams } from 'next/navigation'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { Banner } from '@/components/Global/Banner'

function SetupLayoutContent({ children }: { children?: React.ReactNode }) {
    const dispatch = useAppDispatch()
    const isPWA = usePWAStatus()
    const searchParams = useSearchParams()

    useEffect(() => {
        // filter steps and set them in redux state
        const filteredSteps = setupSteps.filter((step) => {
            return step.screenId !== 'pwa-install' || !isPWA
        })
        dispatch(setupActions.setSteps(filteredSteps))
    }, [isPWA])

    return (
        <>
            <Banner />
            {children}
        </>
    )
}

const SetupLayout = ({ children }: { children?: React.ReactNode }) => {
    return (
        <Suspense fallback={<PeanutLoading coverFullScreen />}>
            <SetupLayoutContent>{children}</SetupLayoutContent>
        </Suspense>
    )
}

export default SetupLayout

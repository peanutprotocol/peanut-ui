'use client'

import { useAuth } from '@/context/authContext'
import { usePWAStatus } from '@/hooks/usePWAStatus'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { setupSteps } from '../../components/Setup/Setup.consts'
import '../../styles/globals.bruddle.css'

const SetupLayout = ({ children }: { children?: React.ReactNode }) => {
    const { user } = useAuth()
    const router = useRouter()
    const dispatch = useAppDispatch()
    const isPWA = usePWAStatus()

    useEffect(() => {
        // if user is logged in, redirect to home
        if (user) {
            router.push('/home')
            return
        }

        // filter steps and set them in redux state
        const filteredSteps = setupSteps.filter((step) => {
            return step.screenId !== 'pwa-install' || !isPWA
        })
        dispatch(setupActions.setSteps(filteredSteps))
    }, [dispatch, isPWA, user])

    return <>{children}</>
}

export default SetupLayout

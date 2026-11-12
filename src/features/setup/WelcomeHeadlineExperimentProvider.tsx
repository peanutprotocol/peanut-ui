'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useIsPresent } from 'framer-motion'
import posthog from 'posthog-js'
import { hasKnownDeviceCredentials } from '@/components/Setup/setup-entry'
import { useNativePlatform } from '@/utils/native-platform'
import { areFeatureFlagsLoaded } from '@/utils/featureFlag.utils'
import { readWelcomeHeadlineVariant, type WelcomeHeadlineVariant } from './welcomeHeadlineExperiment'

const FLAG_WAIT_MS = 1500
type Resolution = { variant: WelcomeHeadlineVariant; reserveSpace: boolean }

const WelcomeHeadlineContext = createContext({
    variant: 'control' as WelcomeHeadlineVariant | null,
    reserveSpace: false,
    cancelPending: () => {},
})

export const useWelcomeHeadlineExperiment = () => useContext(WelcomeHeadlineContext)

export function WelcomeHeadlineExperimentProvider({
    enabled,
    sunsetLanding,
    children,
}: {
    enabled: boolean
    sunsetLanding: boolean
    children: ReactNode
}) {
    const { isCapacitor, isHydrated } = useNativePlatform()
    const isPresent = useIsPresent()
    const [resolution, setResolution] = useState<Resolution | null>(null)
    const settled = useRef(false)
    const waitDeadline = useRef<number | null>(null)
    const dispose = useRef<() => void>(() => {})
    const cancelPending = useCallback(() => {
        if (settled.current) return
        settled.current = true
        dispose.current()
        setResolution({ variant: 'control', reserveSpace: true })
    }, [])

    useEffect(() => {
        if (!enabled || !isHydrated || !isPresent || settled.current) return
        const eligible = isCapacitor && !sunsetLanding && !hasKnownDeviceCredentials()
        let active = true
        let unsubscribe: (() => void) | undefined
        let timer: ReturnType<typeof setTimeout> | undefined
        const clear = () => {
            clearTimeout(timer)
            const remove = unsubscribe
            unsubscribe = undefined
            remove?.()
        }
        dispose.current = clear
        const deadline = waitDeadline.current ?? Date.now() + FLAG_WAIT_MS
        if (eligible) waitDeadline.current = deadline
        const settle = (read: boolean) => {
            if (!active || settled.current) return
            settled.current = true
            clear()
            const canExpose = read && !hasKnownDeviceCredentials() && Date.now() < deadline
            setResolution({ variant: readWelcomeHeadlineVariant(canExpose), reserveSpace: eligible })
        }
        const onFlags = () => {
            if (Date.now() >= deadline) settle(false)
            else if (areFeatureFlagsLoaded()) settle(true)
        }

        if (!eligible || Date.now() >= deadline) settle(false)
        else if (areFeatureFlagsLoaded()) settle(true)
        else {
            timer = setTimeout(() => settle(false), Math.max(0, deadline - Date.now()))
            unsubscribe = posthog.onFeatureFlags(onFlags)
            // The SDK may deliver cached flags inside onFeatureFlags.
            if (settled.current) clear()
        }
        return () => {
            active = false
            clear()
        }
    }, [enabled, isHydrated, isPresent, isCapacitor, sunsetLanding])

    const pendingNative =
        enabled && (isCapacitor || (!isHydrated && process.env.NEXT_PUBLIC_CAPACITOR_BUILD === 'true'))
    return (
        <WelcomeHeadlineContext.Provider
            value={{
                variant: resolution?.variant ?? (pendingNative ? null : 'control'),
                reserveSpace: resolution?.reserveSpace ?? pendingNative,
                cancelPending,
            }}
        >
            {children}
        </WelcomeHeadlineContext.Provider>
    )
}

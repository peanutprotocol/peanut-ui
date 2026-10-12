'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import {
    currentSetupCountrySignals,
    recordSetupIpCountry,
    serverSetupCountrySignals,
    startSetupCountrySignals,
    subscribeSetupCountrySignals,
} from './country-signals'

export function useSetupCountrySignals() {
    const { countryCode } = useGeoLocation()
    const signals = useSyncExternalStore(
        subscribeSetupCountrySignals,
        currentSetupCountrySignals,
        serverSetupCountrySignals
    )
    useEffect(() => {
        void startSetupCountrySignals()
    }, [])
    useEffect(() => {
        recordSetupIpCountry(countryCode)
    }, [countryCode])
    return signals
}

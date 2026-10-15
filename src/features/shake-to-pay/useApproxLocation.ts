'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { isCapacitor } from '@/utils/capacitor'
import type { ShakeLocation } from './shakeApi'

export type ApproxLocationStatus = 'pending' | 'granted' | 'denied' | 'unavailable'

const POSITION_OPTIONS = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 120_000 }

type Fix = { latitude: number; longitude: number; accuracy: number }
type Outcome = { location: ShakeLocation | null; status: ApproxLocationStatus }

/** Rounded on the device (~110 m) so a precise position never leaves it. */
export function toShakeLocation(fix: Fix): ShakeLocation | null {
    const { latitude, longitude, accuracy } = fix
    if (![latitude, longitude, accuracy].every(Number.isFinite) || accuracy <= 0) return null
    return {
        latitude: Math.round(latitude * 1000) / 1000,
        longitude: Math.round(longitude * 1000) / 1000,
        accuracyM: Math.ceil(accuracy),
    }
}

function fromFix(fix: Fix): Outcome {
    const location = toShakeLocation(fix)
    return location ? { location, status: 'granted' } : { location: null, status: 'unavailable' }
}

async function nativeLocation(): Promise<Outcome> {
    // An OTA bundle can run on a binary built before the plugin was added. Falling
    // back to navigator.geolocation there would show the old binary's location
    // prompt, whose wording doesn't cover this use, so such builds go without.
    if (!Capacitor.isPluginAvailable('Geolocation')) return { location: null, status: 'unavailable' }
    const { Geolocation } = await import('@capacitor/geolocation')
    const current = await Geolocation.checkPermissions()
    const permission =
        current.coarseLocation === 'granted'
            ? current
            : await Geolocation.requestPermissions({ permissions: ['coarseLocation'] })
    if (permission.coarseLocation !== 'granted') return { location: null, status: 'denied' }
    const position = await Geolocation.getCurrentPosition(POSITION_OPTIONS)
    return fromFix(position.coords)
}

function webLocation(): Promise<Outcome> {
    return new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            resolve({ location: null, status: 'unavailable' })
            return
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve(fromFix(position.coords)),
            (error) =>
                resolve({
                    location: null,
                    status: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
                }),
            POSITION_OPTIONS
        )
    })
}

/**
 * One coarse fix for the shake screen. Never throws and never blocks a shake:
 * without a fix the search still runs, matching on time alone.
 */
export function useApproxLocation(): Outcome {
    const [outcome, setOutcome] = useState<Outcome>({ location: null, status: 'pending' })

    useEffect(() => {
        let active = true
        const lookup = isCapacitor() ? nativeLocation() : webLocation()
        lookup
            .catch((): Outcome => ({ location: null, status: 'unavailable' }))
            .then((result) => {
                if (active) setOutcome(result)
            })
        return () => {
            active = false
        }
    }, [])

    return outcome
}

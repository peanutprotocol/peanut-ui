'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createShakeDetector, type MotionSample } from './shakeDetector'

export type ShakeMotionStatus = 'unsupported' | 'needs-permission' | 'denied' | 'listening'

/** Desktop browsers define DeviceMotionEvent but never fire it; silence this long means no sensor. */
export const MOTION_PROBE_MS = 1500

type MotionPermissionApi = { requestPermission?: () => Promise<'granted' | 'denied' | 'default'> }

function motionApi(): MotionPermissionApi | null {
    if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') return null
    return window.DeviceMotionEvent as unknown as MotionPermissionApi
}

export function motionSampleFromEvent(event: DeviceMotionEvent): MotionSample | null {
    const gravity = event.accelerationIncludingGravity
    const linear = event.acceleration
    const rotation = event.rotationRate
    const finiteVector = (values: (number | null | undefined)[]) =>
        values.every((value) => typeof value === 'number' && Number.isFinite(value))
    if (
        !finiteVector([gravity?.x, gravity?.y, gravity?.z]) &&
        !finiteVector([linear?.x, linear?.y, linear?.z]) &&
        !finiteVector([rotation?.alpha, rotation?.beta, rotation?.gamma])
    ) {
        return null
    }
    return {
        x: gravity?.x ?? null,
        y: gravity?.y ?? null,
        z: gravity?.z ?? null,
        linear: linear ?? null,
        rotation: rotation ?? null,
        t: event.timeStamp,
    }
}

/**
 * Listens for a physical shake. iOS only delivers motion after
 * DeviceMotionEvent.requestPermission() resolves from a user gesture, so there the
 * hook waits in 'needs-permission' until `requestPermission` runs from a tap.
 */
export function useShakeMotion({ onShake }: { onShake: () => void }) {
    const [status, setStatus] = useState<ShakeMotionStatus>(() => {
        const api = motionApi()
        if (!api) return 'unsupported'
        return typeof api.requestPermission === 'function' ? 'needs-permission' : 'listening'
    })
    const onShakeRef = useRef(onShake)
    onShakeRef.current = onShake

    useEffect(() => {
        if (status !== 'listening') return
        const detector = createShakeDetector()
        let sawMotion = false
        const probe = setTimeout(() => {
            if (!sawMotion) setStatus('unsupported')
        }, MOTION_PROBE_MS)

        const onMotion = (event: DeviceMotionEvent) => {
            const sample = motionSampleFromEvent(event)
            if (!sample) return
            sawMotion = true
            if (detector.push(sample)) onShakeRef.current()
        }
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') detector.reset()
        }

        window.addEventListener('devicemotion', onMotion)
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            clearTimeout(probe)
            window.removeEventListener('devicemotion', onMotion)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [status])

    const requestPermission = useCallback(async () => {
        const api = motionApi()
        if (!api?.requestPermission) return
        try {
            setStatus((await api.requestPermission()) === 'granted' ? 'listening' : 'denied')
        } catch {
            // Rejects when not called from a gesture or when the WebView refuses outright.
            setStatus('denied')
        }
    }, [])

    return { status, requestPermission }
}

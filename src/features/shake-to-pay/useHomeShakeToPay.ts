'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSerializer, parseAsInteger, parseAsStringLiteral } from 'nuqs'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { impactHaptic } from '@/utils/haptics'
import { createShakeDetector } from './shakeDetector'
import { motionSampleFromEvent } from './useShakeMotion'
import {
    forgetMotionGrant,
    hasRememberedMotionGrant,
    motionNeedsPermission,
    type MotionPermissionApi,
} from './motionGrant'

const serializeShakeRoute = createSerializer({ view: parseAsStringLiteral(['shake']), shook: parseAsInteger })

export function useHomeShakeToPay(): void {
    const featureEnabled = useFeatureFlags()
    const enabled = featureEnabled('shake_to_pay', { nonProdBypass: true })
    const router = useRouter()

    useEffect(() => {
        if (!enabled) return
        const needsPermission = motionNeedsPermission()
        if (needsPermission && !hasRememberedMotionGrant()) return
        const detector = createShakeDetector({ modes: ['vigorous', 'twist'] })
        let active = true
        let listening = false
        let navigating = false
        let requested = false

        const onMotion = (event: DeviceMotionEvent) => {
            if (!active || !listening || navigating || document.visibilityState !== 'visible') return
            const sample = motionSampleFromEvent(event)
            if (!sample || !detector.push(sample)) return
            navigating = true
            impactHaptic()
            router.push(serializeShakeRoute('/send', { view: 'shake', shook: 1 }))
        }
        const stopListening = () => {
            if (!listening) return
            window.removeEventListener('devicemotion', onMotion)
            listening = false
        }
        const onVisibility = () => {
            if (!active) return
            if (document.visibilityState !== 'visible') {
                detector.reset()
                stopListening()
            } else if (!listening) {
                window.addEventListener('devicemotion', onMotion)
                listening = true
            }
        }

        const startListening = () => {
            if (!active) return
            document.addEventListener('visibilitychange', onVisibility)
            onVisibility()
        }
        const armPermissionRequest = () => {
            if (!active) return
            requested = false
            document.addEventListener('click', onClick, { capture: true, passive: true, once: true })
        }
        const onClick = () => {
            if (!active || requested) return
            requested = true
            try {
                const api = window.DeviceMotionEvent as unknown as MotionPermissionApi
                void api
                    .requestPermission()
                    .then((permission) => {
                        if (!active) return
                        if (permission === 'granted') startListening()
                        else if (permission === 'denied') forgetMotionGrant()
                    })
                    .catch(armPermissionRequest)
            } catch {
                armPermissionRequest()
            }
        }

        if (needsPermission) {
            armPermissionRequest()
        } else {
            startListening()
        }
        return () => {
            active = false
            document.removeEventListener('click', onClick, true)
            stopListening()
            document.removeEventListener('visibilitychange', onVisibility)
            detector.reset()
        }
    }, [enabled, router])
}

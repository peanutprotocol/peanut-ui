'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSerializer, parseAsInteger, parseAsStringLiteral } from 'nuqs'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { impactHaptic } from '@/utils/haptics'
import { createShakeDetector } from './shakeDetector'
import { motionSampleFromEvent } from './useShakeMotion'

const serializeShakeRoute = createSerializer({ view: parseAsStringLiteral(['shake']), shook: parseAsInteger })

export function useHomeShakeToPay(): void {
    const featureEnabled = useFeatureFlags()
    const enabled = featureEnabled('shake_to_pay', { nonProdBypass: true })
    const router = useRouter()

    useEffect(() => {
        if (!enabled) return
        const detector = createShakeDetector({ modes: ['vigorous', 'twist'] })
        let active = true
        let listening = false
        let navigating = false

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

        document.addEventListener('visibilitychange', onVisibility)
        onVisibility()
        return () => {
            active = false
            stopListening()
            document.removeEventListener('visibilitychange', onVisibility)
            detector.reset()
        }
    }, [enabled, router])
}

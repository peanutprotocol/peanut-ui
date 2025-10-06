'use client'

import { useEffect } from 'react'
import { captureException } from '@sentry/nextjs'

export function ScreenOrientationLocker() {
    useEffect(() => {
        // Only run on client-side and check if screen API exists
        if (typeof window === 'undefined' || !window.screen) {
            return
        }

        const lockOrientation = async () => {
            // Check if orientation API is available
            if (!screen.orientation || !(screen.orientation as any).lock) {
                return
            }

            try {
                await (screen.orientation as any).lock('portrait-primary')
            } catch (error) {
                // Only log to console, don't report to Sentry as this is expected behavior
                // on desktop browsers and environments that don't support orientation lock
                console.debug('Screen orientation lock not available on this device/browser:', error)
                // Don't capture this as it's expected behavior in many environments
            }
        }

        lockOrientation()

        const handleOrientationChange = () => {
            // if the orientation is no longer portrait, try to lock it back.
            if (screen.orientation && !screen.orientation.type.startsWith('portrait')) {
                lockOrientation()
            }
        }

        // some browsers might not support addEventListener on screen.orientation
        if (screen.orientation && screen.orientation.addEventListener) {
            screen.orientation.addEventListener('change', handleOrientationChange)

            return () => {
                screen.orientation.removeEventListener('change', handleOrientationChange)
            }
        }
    }, [])

    return null
}

'use client'

import { useEffect } from 'react'
import { captureException } from '@sentry/nextjs'

export function ScreenOrientationLocker() {
    useEffect(() => {
        const lockOrientation = async () => {
            if (screen.orientation && (screen.orientation as any).lock) {
                try {
                    await (screen.orientation as any).lock('portrait-primary')
                } catch (error) {
                    console.error('Failed to lock screen orientation:', error)
                    captureException(error)
                }
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

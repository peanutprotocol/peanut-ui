'use client'

import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useEffect, useRef } from 'react'

const soundMap = {
    success: '/sounds/success.mp3',
}

export type SoundType = keyof typeof soundMap

type SoundPlayerProps = {
    sound: SoundType
}

/**
 * Plays an audio file with autoplay policy handling.
 * If autoplay is blocked, it will attempt to play on the next user interaction.
 * @param audioSrc - The path to the audio file
 * @param soundName - Optional name for error logging
 * @param restrictToIOSOnly - If true, only plays on iOS devices. Defaults to false.
 * @returns A cleanup function to stop audio and remove listeners
 */
export const playSound = (audioSrc: string, soundName?: string, restrictToIOSOnly: boolean = false): (() => void) => {
    // Check if restricted to iOS only
    if (restrictToIOSOnly) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        if (!isIOS) {
            return () => {} // no-op cleanup for non-iOS devices
        }
    }

    const audio = new Audio(audioSrc)
    audio.preload = 'auto'

    let listenersAdded = false
    let unlock: (() => void) | null = null

    const removeListeners = () => {
        if (!listenersAdded || !unlock) return
        document.removeEventListener('pointerdown', unlock)
        document.removeEventListener('touchstart', unlock)
        document.removeEventListener('click', unlock)
        listenersAdded = false
        unlock = null
    }

    audio
        .play()
        .then(() => {
            // success, nothing else to do
        })
        .catch((error: any) => {
            const message = String(error?.message || '')
            const isAutoplayBlocked =
                error?.name === 'NotAllowedError' || /gesture|autoplay|play\(\) failed/i.test(message)

            if (isAutoplayBlocked) {
                // defer playback until next user interaction
                unlock = () => {
                    audio
                        .play()
                        .catch((e) => {
                            console.error(
                                `Audio play failed after user interaction${soundName ? ` for sound "${soundName}"` : ''}:`,
                                e
                            )
                        })
                        .finally(() => {
                            removeListeners()
                        })
                }
                document.addEventListener('pointerdown', unlock, { once: true })
                document.addEventListener('touchstart', unlock, { once: true })
                document.addEventListener('click', unlock, { once: true })
                listenersAdded = true
            } else {
                console.error(`Audio play failed${soundName ? ` for sound "${soundName}"` : ''}:`, error)
            }
        })

    // return cleanup function
    return () => {
        removeListeners()
        try {
            audio.pause()
        } catch (_) {
            // ignore
        }
    }
}

/**
 * Helper to play a sound by name from the soundMap
 * @param sound - The sound name from the soundMap
 * @returns A cleanup function
 */
export const playSoundByName = (sound: SoundType, restrictToIOSOnly: boolean = false): (() => void) => {
    const audioSrc = soundMap[sound]
    if (!audioSrc) {
        console.warn(`Sound "${sound}" not found in soundMap`)
        return () => {}
    }
    return playSound(audioSrc, sound, restrictToIOSOnly)
}

/**
 * Plays a sound effect when mounted (e.g., on success events).
 * Only plays on non-iOS devices due to iOS autoplay restrictions.
 * @param sound - The type of sound to play.
 * @returns null
 */
export const SoundPlayer = ({ sound }: SoundPlayerProps) => {
    const cleanupRef = useRef<(() => void) | null>(null)
    const { deviceType } = useDeviceType()

    useEffect(() => {
        // Only play on non-iOS devices
        if (!deviceType || deviceType === DeviceType.IOS) return

        const cleanup = playSoundByName(sound)
        cleanupRef.current = cleanup

        return () => {
            if (cleanupRef.current) {
                cleanupRef.current()
                cleanupRef.current = null
            }
        }
    }, [sound, deviceType])

    return null
}

'use client'

import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useEffect, useRef } from 'react'

const soundMap = {
    success: '/sounds/success.mp3',
}

type SoundPlayerProps = {
    sound: keyof typeof soundMap
}

/**
 * Plays a sound effect when a success event occurs.
 * @param sound - The type of sound to play.
 * @returns null
 */
export const SoundPlayer = ({ sound }: SoundPlayerProps) => {
    const audioRef = useRef<HTMLAudioElement | null>(null)

    const { deviceType } = useDeviceType()

    // Early return for iOS devices - completely disable sound
    if (deviceType === DeviceType.IOS) {
        return null
    }

    useEffect(() => {
        const audioSrc = soundMap[sound]
        if (!audioSrc) return

        // create audio element and prepare to play, hint browser to load audio early, keep a ref so we can clean up later
        const audio = new Audio(audioSrc)
        audio.preload = 'auto'
        audioRef.current = audio

        // track if we attached one-time unlock listeners and the unlock handler
        let listenersAdded = false
        let unlock: (() => void) | null = null

        // clean up any unlock listeners if they were added
        const removeListeners = () => {
            if (!listenersAdded || !unlock) return
            document.removeEventListener('pointerdown', unlock)
            document.removeEventListener('touchstart', unlock)
            document.removeEventListener('click', unlock)
            listenersAdded = false
            unlock = null
        }

        // try to play immediately, if blocked by autoplay policies, wait for user interaction
        const tryPlay = () =>
            audio
                .play()
                .then(() => {
                    // success, nothing else to do
                })
                .catch((error: any) => {
                    // detect common autoplay restriction errors
                    const message = String(error?.message || '')
                    const isAutoplayBlocked =
                        error?.name === 'NotAllowedError' || /gesture|autoplay|play\(\) failed/i.test(message)

                    if (isAutoplayBlocked) {
                        // defer playback until next user interaction (mobile/pwa autoplay policies)
                        unlock = () => {
                            audio
                                .play()
                                .catch((e) => {
                                    console.error(`Audio play failed after user interaction for sound "${sound}":`, e)
                                })
                                .finally(() => {
                                    removeListeners()
                                })
                        }
                        // attach one-time listeners so the first tap/click resumes playback
                        document.addEventListener('pointerdown', unlock, { once: true })
                        document.addEventListener('touchstart', unlock, { once: true })
                        document.addEventListener('click', unlock, { once: true })
                        listenersAdded = true
                    } else {
                        console.error(`Audio play failed for sound "${sound}":`, error)
                    }
                })

        tryPlay()

        return () => {
            // on unmount, remove listeners and stop audio if needed
            removeListeners()
            if (audioRef.current) {
                try {
                    audioRef.current.pause()
                } catch (_) {
                    // ignore
                }
            }
            audioRef.current = null
        }
    }, [sound])

    return null
}

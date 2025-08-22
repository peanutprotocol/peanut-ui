'use client'

import { useEffect } from 'react'

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
    useEffect(() => {
        const audioSrc = soundMap[sound]
        if (audioSrc) {
            const audio = new Audio(audioSrc)
            audio.play().catch((error) => {
                console.error(`Audio play failed for sound "${sound}":`, error)
            })
        }
    }, [sound])

    return null
}

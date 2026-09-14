'use client'

import { useSyncExternalStore } from 'react'
import { readLetterAvatar, subscribeLetterAvatar } from './avatar-letter.storage'

/**
 * Resolves the avatar key to render: the server's pick, or the device-local
 * letter fallback when the API has not accepted one yet.
 *
 * The caller passes the server key rather than the hook reading it, because
 * there is no single source to read — the home flow takes the user from the
 * redux store and the profile surfaces take it from authContext, and a hook
 * that picked one would silently return the wrong value on the other.
 *
 * A mirror only wins while the server key still matches what it was written
 * against. Two things could otherwise strand it: a successful write on THIS
 * device (handled by clearing the mirror in AvatarPicker.save), and a pick made
 * on ANOTHER device, which this device only ever learns about by refetching —
 * so the stored serverKey is what lets that refetch take precedence.
 *
 * The server snapshot is null on purpose: reading localStorage during render
 * would make the server and client markup differ and trip hydration. The letter
 * lands on the first client commit instead, one frame after the day-0 initial —
 * the same art whenever the letter matches the username's first character, so
 * in the common case nothing visibly changes.
 */
export function useAvatarKey(rawServerKey: string | null | undefined, userId: string | undefined): string | null {
    const serverKey = rawServerKey ?? null
    const mirror = useSyncExternalStore(
        subscribeLetterAvatar,
        () => readLetterAvatar(userId),
        () => null
    )

    const fresh = mirror && mirror.serverKey === serverKey ? mirror.key : null
    return fresh ?? serverKey
}

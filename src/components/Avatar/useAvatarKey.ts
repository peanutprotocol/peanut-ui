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
 * Precedence is "local letter wins when it exists", which is only safe because
 * every successful server write clears the mirror (AvatarPicker.save). So a
 * mirror can only survive while the server holds nothing newer, and the two can
 * never disagree about which pick came last.
 *
 * The server snapshot is null on purpose: reading localStorage during render
 * would make the server and client markup differ and trip hydration. The letter
 * lands on the first client commit instead, one frame after the day-0 initial —
 * the same art whenever the letter matches the username's first character, so
 * in the common case nothing visibly changes.
 */
export function useAvatarKey(serverKey: string | null | undefined, userId: string | undefined): string | null {
    const localLetter = useSyncExternalStore(
        subscribeLetterAvatar,
        () => readLetterAvatar(userId),
        () => null
    )

    return localLetter ?? serverKey ?? null
}

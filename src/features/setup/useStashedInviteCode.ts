'use client'

import { useEffect, useState } from 'react'
import { readInviteCode, subscribeInviteStash } from '@/utils/invite-stash'

/**
 * The stashed invite code ('' when none), kept current. A deferred link (Android Play Install Referrer, iOS clipboard
 * hand-off) or an invite link writes it, sometimes after the first render, so it is read after mount and on change.
 */
export function useStashedInviteCode(): string {
    const [inviteCode, setInviteCode] = useState('')
    useEffect(() => {
        const update = () => setInviteCode(readInviteCode())
        update()
        return subscribeInviteStash(update)
    }, [])
    return inviteCode
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { invitesApi } from '@/services/invites'
import { useStashedInviteCode } from './useStashedInviteCode'

/**
 * The inviter to name on Landing: the username the API returns for the stashed invite code, or null while the
 * check runs, when it fails, or when the code is not an invite. The stash is never shown as is: its writers
 * (/setup?code=, the /invite deep link, the deferred link) do not validate it (Kush review, 2026-11-18).
 */
export function useValidatedInviter(): string | null {
    const code = useStashedInviteCode()
    const { data } = useQuery({
        // the same key as the /invite page, so a code checked there is not checked again
        queryKey: ['validateInviteCode', code],
        queryFn: () => invitesApi.validateInviteCode(code!),
        enabled: !!code,
    })
    if (!code || !data?.success) return null
    return data.username.trim() || null
}

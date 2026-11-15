'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsString, useQueryStates } from 'nuqs'
import { useAuth } from '@/context/authContext'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import {
    EMPTY_PIX_WITHDRAW_DRAFT,
    keepPixWithdrawDraft,
    readPixWithdrawDraft,
    type PixWithdrawDraft,
} from '@/features/pix/pixWithdrawDraft'

/** The query keys the form rode in before it left the URL; an old link or a stale tab still carries them. */
const URL_FORM = {
    destination: parseAsString,
    amount: parseAsString,
    destinationAmount: parseAsString,
    spend: parseAsString,
}

/** The whole form an old URL carries (a key it leaves out is empty), or null when it carries none. */
function draftFromUrl(url: Record<keyof typeof URL_FORM, string | null>): PixWithdrawDraft | null {
    if (Object.values(url).every((value) => value === null)) return null
    return {
        destination: url.destination ?? '',
        amountUsd: url.amount ?? '',
        amountBrl: url.destinationAmount ?? '',
        spendUsd: url.spend ?? '',
    }
}

/**
 * The signed-in account's Pix withdraw form (`pixWithdrawDraft`), read back on mount so a refresh
 * restores it. A send (`sendMethod` in the URL) keeps its own draft apart from a withdrawal's. A URL that still carries the old form keys hands their values to the draft and is
 * replaced without them at once, so a Pix key never stays in the address bar. `update` changes the
 * fields it names; `clear` forgets the form.
 */
export function usePixWithdrawDraft() {
    const { user } = useAuth()
    const userId = user?.user?.userId
    const flow = useSendFlowOrigin().isFromSendFlow ? 'send' : 'withdraw'
    const [url, setUrl] = useQueryStates(URL_FORM, { history: 'replace' })
    const fromUrl = draftFromUrl(url)
    const [held, setHeld] = useState(() => ({ userId, flow, draft: fromUrl ?? readPixWithdrawDraft(userId, flow) }))
    // another account signed in on this page, or the other flow: its own draft, never the last one's
    const draft = held.userId === userId && held.flow === flow ? held.draft : readPixWithdrawDraft(userId, flow)

    const keep = useCallback(
        (next: PixWithdrawDraft) => {
            setHeld({ userId, flow, draft: next })
            keepPixWithdrawDraft(userId, flow, next)
        },
        [userId, flow]
    )
    const update = useCallback((fields: Partial<PixWithdrawDraft>) => keep({ ...draft, ...fields }), [keep, draft])
    const clear = useCallback(() => keep(EMPTY_PIX_WITHDRAW_DRAFT), [keep])

    const urlForm = fromUrl ? JSON.stringify(fromUrl) : null
    useEffect(() => {
        if (!urlForm) return
        keep(JSON.parse(urlForm) as PixWithdrawDraft)
        void setUrl({ destination: null, amount: null, destinationAmount: null, spend: null })
    }, [urlForm, keep, setUrl])

    return { draft, update, clear }
}

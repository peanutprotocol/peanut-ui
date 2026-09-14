'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsReceipt'
import {
    mapTransactionDataForDrawer,
    type TransactionDetails,
} from '@/components/TransactionDetails/transactionTransformer'
import type { IntentKind } from '@/components/TransactionDetails/strategies/registry'
import { TRANSACTIONS } from '@/constants/query.consts'
import { apiFetch } from '@/utils/api-fetch'
import { getAuthToken } from '@/utils/auth-token'
import { completeHistoryEntry } from '@/utils/history.utils'

/**
 * The receipt page, with one client-side read for the signed-in owner.
 *
 * The page renders on the server, and the server render is always anonymous:
 * `serverFetch` reads the session through `getAuthToken()`, which reads
 * js-cookie, which no-ops in a server component. The API is fine with that —
 * `/history/:entryId` is a capability URL and takes optional auth — but it
 * means the owner's OWN deposit receipt comes back in the public projection.
 * For a deposit that arrived on a standing bank account that is the wrong
 * document: the API aliases the retired crypto-link entry onto the canonical
 * virtual-account receipt for the owner and for nobody else, and the server
 * render never asks as the owner, so the owner never saw it.
 *
 * So the owner asks once more from the browser, where the token exists. The
 * cookie is deliberately NOT forwarded into `getHistoryEntry`: that function
 * is shared with the PDF route, which caches by entry, kind and locale under
 * a public `s-maxage`, and an owner-only body in that cache is a stranger's
 * bank details served to whoever asks next.
 *
 * Bounded on purpose — one request, no polling, no retry, and only where the
 * answer can differ:
 *   - `CRYPTO_DEPOSIT` only. That is the one kind the owner alias applies to.
 *   - Only with a token in the browser. Anonymous viewers and non-owner
 *     holders of an old link keep the public view, which is the whole point of
 *     a shared receipt.
 *   - A failure changes nothing: the server's projection stays on screen.
 */
export function OwnerReceiptView({
    entryId,
    kind,
    serverDetails,
}: {
    entryId: string
    kind: IntentKind
    /** what the anonymous server render produced; shown until an owner read lands */
    serverDetails: TransactionDetails
}) {
    // read after mount: js-cookie is empty during the server render, and
    // branching on it in the first client render is a hydration mismatch
    const [hasSession, setHasSession] = useState(false)
    useEffect(() => setHasSession(Boolean(getAuthToken())), [])

    const { data } = useQuery({
        queryKey: [TRANSACTIONS, 'entry', entryId, kind, 'owner'],
        enabled: hasSession && kind === 'CRYPTO_DEPOSIT',
        retry: false,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        queryFn: async (): Promise<TransactionDetails> => {
            const query = new URLSearchParams({ kind }).toString()
            const response = await apiFetch(`/history/${encodeURIComponent(entryId)}?${query}`)
            if (!response.ok) throw new Error(`Failed to fetch history entry: ${response.status}`)
            const entry = await completeHistoryEntry(await response.json())
            return mapTransactionDataForDrawer(entry).transactionDetails
        },
    })

    return <TransactionDetailsReceipt className="w-full" transaction={data ?? serverDetails} isPublic />
}

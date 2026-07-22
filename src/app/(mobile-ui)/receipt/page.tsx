'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsReceipt'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { resolveReceiptKind } from '@/components/TransactionDetails/strategies/registry'
import { TRANSACTIONS } from '@/constants/query.consts'
import { apiFetch } from '@/utils/api-fetch'
import { completeHistoryEntry, isFinalState, type HistoryEntry } from '@/utils/history.utils'

// Client twin of the web /receipt/[entryId] page. That one is a server component
// and is stripped from the static export (scripts/native-build.js), so a receipt
// deep link — the most common push destination — had nothing to render natively.
// deepLinkToNativePath maps /receipt/<id>?kind=X onto this route's query params.
export default function NativeReceiptPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const entryId = searchParams.get('id')
    const kind = resolveReceiptKind(searchParams.get('kind') ?? undefined, searchParams.get('t') ?? undefined)

    const {
        data: entry,
        isLoading,
        isError,
    } = useQuery({
        queryKey: [TRANSACTIONS, 'entry', entryId, kind],
        enabled: Boolean(entryId && kind),
        queryFn: async (): Promise<HistoryEntry> => {
            const response = await apiFetch(`/history/${encodeURIComponent(entryId!)}?kind=${kind}`)
            if (!response.ok) throw new Error(`Failed to fetch history entry: ${response.status}`)
            return completeHistoryEntry(await response.json())
        },
        // A pending transaction can still settle while the receipt is open.
        refetchInterval: (query) => (query.state.data && !isFinalState(query.state.data) ? 15_000 : false),
    })

    // `isError` also trips on a failed background poll, so gate the bail-out on
    // having no data at all — a flaky refetch must not yank the user off a
    // receipt they're watching settle.
    const isUnrecoverable = !entryId || !kind || (isError && !entry)

    useEffect(() => {
        if (isUnrecoverable) router.replace('/home')
    }, [isUnrecoverable, router])

    if (isUnrecoverable) return null

    return (
        <PageContainer className="flex min-h-[100dvh] flex-col items-center justify-center p-6">
            <div className="md:hidden">
                <NavHeader title="Receipt" />
            </div>
            <div className="flex flex-1 flex-col items-center justify-center">
                {isLoading || !entry ? (
                    <PeanutLoading />
                ) : (
                    <TransactionDetailsReceipt
                        className="w-full"
                        transaction={mapTransactionDataForDrawer(entry).transactionDetails}
                    />
                )}
            </div>
        </PageContainer>
    )
}

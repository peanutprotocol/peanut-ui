'use client'

import { useSearchParams } from 'next/navigation'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import NavHeader from '@/components/Global/NavHeader'
import Loading from '@/components/Global/Loading'
import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsReceipt'
import { ReceiptUnavailable } from '@/components/TransactionDetails/ReceiptUnavailable'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { resolveReceiptKind } from '@/components/TransactionDetails/strategies/registry'
import { useHistoryEntry } from '@/hooks/useHistoryEntry'

// Client twin of the web /receipt/[entryId] page. That one is a server component
// and is stripped from the static export (scripts/native-build.js), so a receipt
// deep link — the most common push destination — had nothing to render natively.
// deepLinkToNativePath maps /receipt/<id>?kind=X onto this route's query params.
export default function NativeReceiptPage() {
    const searchParams = useSearchParams()
    const entryId = searchParams.get('id')
    const kind = resolveReceiptKind(searchParams.get('kind') ?? undefined, searchParams.get('t') ?? undefined)

    // Polls while the transaction or its network fee can still settle.
    const { data: entry, isLoading, isError, refetch } = useHistoryEntry(entryId, kind)

    // `isError` also trips on a failed background poll, so gate the bail-out on
    // having no data at all — a flaky refetch must not yank the user off a
    // receipt they're watching settle. An unresolvable link (or a fetch that
    // never produced data) shows the branded unavailable state instead of a
    // silent bounce to /home.
    const unavailable = !entryId || !kind ? 'gone' : isError && !entry ? 'loadFailed' : undefined

    return (
        <PageContainer className="receipt-page flex min-h-dvh flex-col items-center p-4">
            {/* app chrome: mobile only, and never on the printed/PDF receipt */}
            <div className="md:hidden print:hidden">
                <NavHeader titleKey="receipt" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col items-center py-4">
                {unavailable ? (
                    <div className="m-auto">
                        <ReceiptUnavailable
                            variant={unavailable}
                            onRetry={unavailable === 'loadFailed' ? () => void refetch() : undefined}
                        />
                    </div>
                ) : isLoading || !entry ? (
                    <div className="m-auto">
                        <Loading variant="mascot" />
                    </div>
                ) : (
                    <TransactionDetailsReceipt
                        className="my-auto w-full"
                        transaction={mapTransactionDataForDrawer(entry).transactionDetails}
                    />
                )}
            </div>
        </PageContainer>
    )
}

import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { isFinalState, historyTypeFromNumber } from '@/utils/history.utils'
import { getHistoryEntry } from '@/app/actions/history'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsReceipt'
import NavHeader from '@/components/Global/NavHeader'

export default async function ReceiptPage({
    params,
    searchParams,
}: {
    params: Promise<{ entryId: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const { entryId } = await params
    let entryTypeId = (await searchParams).t
    if (!entryId || !entryTypeId || typeof entryTypeId !== 'string' || !historyTypeFromNumber(Number(entryTypeId))) {
        notFound()
    }
    const entryType = historyTypeFromNumber(Number(entryTypeId))
    const entry = await getHistoryEntry(entryId, entryType)
    if (!entry) {
        notFound()
    }
    if (!isFinalState(entry)) {
        await connection()
    }
    const { transactionDetails } = mapTransactionDataForDrawer(entry)
    return (
        <div className="p-6">
            <div className="md:hidden">
                <NavHeader title="Receipt" />
            </div>
            <div className="flex min-h-[100dvh] flex-col items-center justify-center">
                <TransactionDetailsReceipt className="w-full" transaction={transactionDetails!} />
            </div>
        </div>
    )
}

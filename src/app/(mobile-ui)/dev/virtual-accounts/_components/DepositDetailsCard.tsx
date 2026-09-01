import Card from '@/components/Global/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import type { VaDetailRow } from './types'

/**
 * The bank-details receipt card: the parent owns padding and the dashed
 * dividers, DataRow renders no borders (design.md "receipt / detail card").
 * Shipped reference: TransactionDetails/ReceiptDetailsCard.
 */
export function DepositDetailsCard({
    rows,
    memo,
}: {
    rows: VaDetailRow[]
    /** payer view appends the reference as the last row; user view keeps it in MemoSlot */
    memo?: string | null
}) {
    return (
        <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
            {rows.map((row) => (
                <DataRow key={row.label} label={row.label} value={row.value} allowCopy={row.copy !== false} />
            ))}
            {memo && <DataRow label="Payment reference" value={memo} allowCopy />}
        </Card>
    )
}

import { DataRow } from '@/components/0_Bruddle/DataRow'
import Card from '@/components/Global/Card'
import type { DepositDetailRow } from '../types'

/**
 * The bank-details card. The parent owns the padding and the dashed
 * dividers, DataRow draws no borders of its own — design.md's receipt recipe,
 * shipped reference `TransactionDetails/ReceiptDetailsCard`.
 */
export function DepositDetailsCard({ rows }: { rows: DepositDetailRow[] }) {
    return (
        <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
            {rows.map((row) => (
                <DataRow key={row.label} label={row.label} value={row.value} allowCopy={row.copyable !== false} />
            ))}
        </Card>
    )
}

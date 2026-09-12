import { DataRow } from '@/components/0_Bruddle/DataRow'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import Card from '@/components/Global/Card'
import type { DepositDetailRow, DepositRowKey } from '../types'

// design.md's receipt-card rule: DataRow (one line, label left/value right) is
// the receipt row; PaymentInfoRow (label above value) is the older
// payment-details shape — and the two never share a card. A bank address or a
// recipient address is the one field here long enough to wrap onto a second
// line, so it takes the label-above-value row, in a card of its own.
const ADDRESS_ROW_KEYS: DepositRowKey[] = ['bankAddress', 'beneficiaryAddress']

/**
 * The bank-details card. The parent owns the padding and the dashed
 * dividers, DataRow draws no borders of its own — design.md's receipt recipe,
 * shipped reference `TransactionDetails/ReceiptDetailsCard`.
 */
export function DepositDetailsCard({ rows }: { rows: DepositDetailRow[] }) {
    const mainRows = rows.filter((row) => !ADDRESS_ROW_KEYS.includes(row.key))
    const addressRows = rows.filter((row) => ADDRESS_ROW_KEYS.includes(row.key))

    return (
        <div className="flex flex-col gap-2">
            <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
                {mainRows.map((row) => (
                    <DataRow key={row.label} label={row.label} value={row.value} allowCopy={row.copyable !== false} />
                ))}
            </Card>
            {addressRows.length > 0 && (
                <Card position="single" className="px-4 py-0">
                    {addressRows.map((row, index) => (
                        <PaymentInfoRow
                            key={row.label}
                            label={row.label}
                            value={row.value}
                            allowCopy={row.copyable !== false}
                            hideBottomBorder={index === addressRows.length - 1}
                        />
                    ))}
                </Card>
            )}
        </div>
    )
}

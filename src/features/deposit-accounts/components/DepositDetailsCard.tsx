import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import Card from '@/components/Global/Card'
import type { DepositDetailRow } from '../types'

/**
 * The bank-details card: every field in one card, label above value, a copy
 * icon on each — the shape a payer's own bank uses for the same numbers.
 *
 * One row type for every field. design.md never mixes DataRow and
 * PaymentInfoRow in one card, and a bank or recipient address wraps onto a
 * second line, which only the label-above-value row holds. PaymentInfoRow is
 * the DS row for deposit details and draws its own dashed divider.
 */
export function DepositDetailsCard({ rows }: { rows: DepositDetailRow[] }) {
    return (
        <Card position="solo" className="px-4 py-0">
            {rows.map((row, index) => (
                <PaymentInfoRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    allowCopy={row.copyable !== false}
                    hideBottomBorder={index === rows.length - 1}
                />
            ))}
        </Card>
    )
}

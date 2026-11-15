'use client'

import Card from '@/components/Global/Card'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { MonthlyRoom } from '@/interfaces/interfaces'
import type { RailOperation } from '@/types/capabilities'
import { formatAmountWithCurrency, getFlagUrlForCurrency } from '../utils'

interface MonthlyRoomCardProps {
    currency: string
    /** Pix in and Pix out (withdrawals, key sends and QR payments share the payout room). */
    room: { deposit: MonthlyRoom; payout: MonthlyRoom }
    /** The operations this provider serves for the user: a row shows only for an operation it serves. */
    operations: readonly RailOperation[]
}

/** The figure of one direction: reais left, else USD left; a blocked room has nothing left. */
function roomAmount(room: MonthlyRoom, currency: string): string | null {
    if (room.blocked) return formatAmountWithCurrency(0, currency)
    if (room.brlLeft !== null) return formatAmountWithCurrency(parseFloat(room.brlLeft), currency)
    if (room.usdLeft !== null) return formatAmountWithCurrency(parseFloat(room.usdLeft), 'USD')
    return null
}

/** Which of the payout room's operations the provider serves, for its row's label. */
function payoutOperations(operations: readonly RailOperation[]): 'both' | 'withdraw' | 'pay' | null {
    const withdraws = operations.includes('withdraw')
    const pays = operations.includes('pay')
    if (withdraws && pays) return 'both'
    return withdraws ? 'withdraw' : pays ? 'pay' : null
}

/**
 * A provider's monthly room, as the API reads it (API-CONTRACT-M5 §5): what may still move this
 * month in each direction. The provider answers no monthly total, so the card shows no progress bar.
 * Each row names only the operations this provider serves for the user; another provider's limit
 * covers the rest.
 */
export default function MonthlyRoomCard({ currency, room, operations }: MonthlyRoomCardProps) {
    const t = useTranslations('limits.provider')
    const flagUrl = getFlagUrlForCurrency(currency)
    const payoutFor = payoutOperations(operations)
    const rows = [
        {
            key: 'deposit',
            label: t('roomDeposit'),
            amount: operations.includes('deposit') ? roomAmount(room.deposit, currency) : null,
        },
        {
            key: 'payout',
            label: t('roomPayout', { operations: payoutFor ?? 'both' }),
            amount: payoutFor ? roomAmount(room.payout, currency) : null,
        },
    ].filter((row) => row.amount !== null)

    if (rows.length === 0) return null

    return (
        <Card position="solo" className="space-y-3">
            <div className="flex items-center gap-2">
                {flagUrl && (
                    <Image
                        src={flagUrl}
                        alt={currency}
                        width={24}
                        height={24}
                        className="size-5 rounded-full object-cover"
                    />
                )}
                <span className="text-body-xs text-foreground-secondary">
                    {t('leftThisMonth', { asset: currency })}
                </span>
            </div>
            {rows.map((row) => (
                <div key={row.key} className="flex items-center justify-between text-body-s">
                    <span className="text-foreground-secondary">{row.label}</span>
                    <span className="font-medium text-foreground-primary">{row.amount}</span>
                </div>
            ))}
        </Card>
    )
}

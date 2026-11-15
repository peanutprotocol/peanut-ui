'use client'

import Card from '@/components/Global/Card'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { MonthlyRoom } from '@/interfaces/interfaces'
import { formatAmountWithCurrency, getFlagUrlForCurrency } from '../utils'

interface MonthlyRoomCardProps {
    currency: string
    /** Pix in; absent when the user's deposits are not this provider's (a resident abroad has none). */
    deposit?: MonthlyRoom
    /** Pix out: withdrawals, key sends and QR payments share it. */
    payout: MonthlyRoom
}

/** The figure of one direction: reais left, else USD left; a blocked room has nothing left. */
function roomAmount(room: MonthlyRoom, currency: string): string | null {
    if (room.blocked) return formatAmountWithCurrency(0, currency)
    if (room.brlLeft !== null) return formatAmountWithCurrency(parseFloat(room.brlLeft), currency)
    if (room.usdLeft !== null) return formatAmountWithCurrency(parseFloat(room.usdLeft), 'USD')
    return null
}

/**
 * A provider's monthly room, as the API reads it (API-CONTRACT-M5 §5): what may still move this
 * month in each direction. The provider answers no monthly total, so the card shows no progress bar.
 */
export default function MonthlyRoomCard({ currency, deposit, payout }: MonthlyRoomCardProps) {
    const t = useTranslations('limits.provider')
    const flagUrl = getFlagUrlForCurrency(currency)
    const rows = [
        { key: 'deposit', label: t('roomDeposit'), amount: deposit ? roomAmount(deposit, currency) : null },
        { key: 'payout', label: t('roomPayout'), amount: roomAmount(payout, currency) },
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

'use client'

import { useFormatter } from 'next-intl'
import { useCallback, type ReactNode } from 'react'

/**
 * Locale-aware receipt timestamp formatter. The date and time remain separate
 * segments so receipt-card container styles can move time below the date.
 */
export function useReceiptDateFormatter(): (date: Date | null | undefined) => ReactNode {
    const format = useFormatter()

    return useCallback(
        (date: Date | null | undefined) => {
            if (!date || isNaN(date.getTime())) return '—'
            const day = format.dateTime(date, { year: 'numeric', month: 'short', day: 'numeric' })
            const time = format.dateTime(date, { hour: '2-digit', minute: '2-digit', hour12: false })
            return (
                <span>
                    <span>{day}</span> <span className="ds-receipt-date-time whitespace-nowrap">{time}</span>
                </span>
            )
        },
        [format]
    )
}

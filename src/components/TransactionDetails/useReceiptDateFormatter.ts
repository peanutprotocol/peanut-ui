'use client'

import { useFormatter } from 'next-intl'
import { useCallback } from 'react'

/**
 * Locale-aware timestamp formatter for receipt rows ("March 30, 2025 - 14:05").
 * Replaces the en-US-pinned `formatDate` util on every TransactionDetails
 * surface; the em-dash fallback covers lifecycle timestamps that haven't
 * happened yet (e.g. cancelledDate on a live link).
 */
export function useReceiptDateFormatter(): (date: Date | null | undefined) => string {
    const format = useFormatter()

    return useCallback(
        (date: Date | null | undefined) => {
            if (!date || isNaN(date.getTime())) return '—'
            const day = format.dateTime(date, { year: 'numeric', month: 'long', day: 'numeric' })
            const time = format.dateTime(date, { hour: '2-digit', minute: '2-digit', hour12: false })
            return `${day} - ${time}`
        },
        [format]
    )
}

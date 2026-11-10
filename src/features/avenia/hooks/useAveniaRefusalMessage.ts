'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { aveniaWithdrawRefusalKey } from '@/features/avenia/avenia.utils'
import { wireErrorCode } from '@/services/api-error'
import { formatBankAmount } from '@/utils/currency'

/**
 * The user-facing line for a refused withdrawal preview, init or new key (`aveniaWithdrawRefusalKey`).
 * `minimumBrl`: the provider's minimum from the amount step's quote, for the under-minimum line;
 * without it that line is the API's own message.
 */
export function useAveniaRefusalMessage(minimumBrl: string | null = null): (caught: unknown) => string {
    const tAvenia = useTranslations('avenia')
    const tWithdraw = useTranslations('withdraw')
    const tErrors = useTranslations('errors')
    return useCallback(
        (caught: unknown) => {
            const key = aveniaWithdrawRefusalKey(wireErrorCode(caught))
            if (key === 'providerRejected') return tErrors(key)
            if (key === 'pixKeyNotFound') return tWithdraw('pixKey.notFound')
            if (key === 'minimum') {
                if (minimumBrl) return tAvenia('deposit.minimum', { amount: formatBankAmount(minimumBrl, 'BRL') })
                return caught instanceof Error && caught.message ? caught.message : tAvenia('unavailable')
            }
            return tAvenia(key)
        },
        [minimumBrl, tAvenia, tWithdraw, tErrors]
    )
}

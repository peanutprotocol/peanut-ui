'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { AVENIA_MIN_WITHDRAWAL_BRL, aveniaWithdrawRefusalKey } from '@/features/avenia/avenia.utils'
import { wireErrorCode } from '@/services/api-error'
import { formatBankAmount } from '@/utils/currency'

/** The user-facing line for a refused withdrawal preview, init or new key (`aveniaWithdrawRefusalKey`). */
export function useAveniaRefusalMessage(): (caught: unknown) => string {
    const tAvenia = useTranslations('avenia')
    const tWithdraw = useTranslations('withdraw')
    const tErrors = useTranslations('errors')
    return useCallback(
        (caught: unknown) => {
            const key = aveniaWithdrawRefusalKey(wireErrorCode(caught))
            if (key === 'providerRejected') return tErrors(key)
            if (key === 'pixKeyNotFound') return tWithdraw('pixKey.notFound')
            if (key === 'minimum') {
                return tAvenia('deposit.minimum', { amount: formatBankAmount(AVENIA_MIN_WITHDRAWAL_BRL, 'BRL') })
            }
            return tAvenia(key)
        },
        [tAvenia, tWithdraw, tErrors]
    )
}

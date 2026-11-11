'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { pixWithdrawRefusalKey } from '@/features/pix/pixFlow.utils'
import { wireErrorCode } from '@/services/api-error'
import { formatBankAmount } from '@/utils/currency'

/**
 * The user-facing line for a refused withdrawal preview, init or new key (`pixWithdrawRefusalKey`).
 * `minimumBrl`: the provider's minimum from the amount step's quote, for the under-minimum line;
 * without it that line is the API's own message.
 */
export function usePixRefusalMessage(minimumBrl: string | null = null): (caught: unknown) => string {
    const tPix = useTranslations('pix')
    const tWithdraw = useTranslations('withdraw')
    const tErrors = useTranslations('errors')
    return useCallback(
        (caught: unknown) => {
            const key = pixWithdrawRefusalKey(wireErrorCode(caught))
            if (key === 'providerRejected') return tErrors(key)
            if (key === 'pixKeyNotFound') return tWithdraw('pixKey.notFound')
            if (key === 'minimum') {
                if (minimumBrl) return tPix('deposit.minimum', { amount: formatBankAmount(minimumBrl, 'BRL') })
                return caught instanceof Error && caught.message ? caught.message : tPix('unavailable')
            }
            return tPix(key)
        },
        [minimumBrl, tPix, tWithdraw, tErrors]
    )
}

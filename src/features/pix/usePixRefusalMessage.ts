'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { pixWithdrawRefusalKey } from '@/features/pix/pixFlow.utils'
import { ApiError, wireErrorCode } from '@/services/api-error'
import { formatBankAmount } from '@/utils/currency'

/**
 * The user-facing line for a refused withdrawal preview or init (`pixWithdrawRefusalKey`). The
 * under-minimum line names the reais the refusal states (`minAmount`, `currency: 'BRL'`): the
 * provider's own figure, which can differ from the route's. Where the refusal names none,
 * `minimumBrl` (the route's minimum) stands in, and without it the API's own message.
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
                const stated = caught instanceof ApiError && caught.minimum?.currency === 'BRL' ? caught.minimum : null
                if (stated) return tPix('deposit.minimum', { amount: formatBankAmount(stated.amount, 'BRL') })
                if (minimumBrl) return tPix('deposit.minimum', { amount: formatBankAmount(minimumBrl, 'BRL') })
                return caught instanceof Error && caught.message ? caught.message : tPix('unavailable')
            }
            return tPix(key)
        },
        [minimumBrl, tPix, tWithdraw, tErrors]
    )
}

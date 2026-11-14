'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { pixRefusalMinimum, pixWithdrawRefusalKey } from '@/features/pix/pixFlow.utils'
import { wireErrorCode } from '@/services/api-error'
import { formatBankAmount } from '@/utils/currency'

/**
 * The user-facing line for a refused withdrawal preview, init or new key (`pixWithdrawRefusalKey`).
 * The under-minimum line names the figure the refusal states (`pixRefusalMinimum`): the provider's
 * own, which can differ from the route's. Where the refusal names none, `minimumBrl` (the route's
 * minimum) stands in, and without it the API's own message.
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
                const stated = pixRefusalMinimum(caught)
                if (stated) return tPix('deposit.minimum', { amount: formatBankAmount(stated.amount, stated.currency) })
                if (minimumBrl) return tPix('deposit.minimum', { amount: formatBankAmount(minimumBrl, 'BRL') })
                return caught instanceof Error && caught.message ? caught.message : tPix('unavailable')
            }
            return tPix(key)
        },
        [minimumBrl, tPix, tWithdraw, tErrors]
    )
}

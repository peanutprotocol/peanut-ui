'use client'

import { useOptionalAuth } from '@/context/authContext'
import { OwnedCurrencyBalanceNotice } from '@/components/Global/OwnedCurrencyBalanceNotice'
import type { CurrencyBalanceNoticeProps } from '@/components/Global/CurrencyBalanceNotice.types'

export function CurrencyBalanceNotice(props: CurrencyBalanceNoticeProps) {
    const auth = useOptionalAuth()
    return auth?.userId ? <OwnedCurrencyBalanceNotice key={auth.userId} userId={auth.userId} {...props} /> : null
}

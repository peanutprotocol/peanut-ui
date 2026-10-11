'use client'

import { useRef } from 'react'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces/interfaces'
import { invalidateCurrencyOperationSession } from '@/utils/currency-operation-recovery'
import { CurrencyAccountsHomeSession } from './CurrencyAccountsHomeSession'
import type { CurrencyAccountsHomeProps } from './currency-account.types'

export function CurrencyAccountsHome(props: CurrencyAccountsHomeProps) {
    const { userId, user } = useAuth()
    const walletAddress = user?.accounts.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier
    const identity = `${userId}:${walletAddress}`
    const previous = useRef({ identity, userId })
    const resetUrl = previous.current.identity !== identity
    if (resetUrl) {
        if (previous.current.userId) invalidateCurrencyOperationSession(previous.current.userId)
        previous.current = { identity, userId }
    }
    return (
        <CurrencyAccountsHomeSession
            key={identity}
            userId={walletAddress ? userId : undefined}
            resetUrl={resetUrl}
            {...props}
        />
    )
}

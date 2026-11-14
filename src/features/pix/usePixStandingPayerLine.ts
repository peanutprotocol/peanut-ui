'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/authContext'
import { corridorFromRailId } from '@/features/deposit-accounts/rails'
import { holdsSlot } from '@/features/deposit-accounts/resolveScreen'
import { senderLimitKey } from '@/features/deposit-accounts/ruleLines'
import { DEPOSIT_ACCOUNTS_QUERY_KEY } from '@/features/deposit-accounts/useDepositAccounts'
import { PIX_METHOD } from '@/features/pix/pixRoute.utils'
import { fetchDepositAccounts } from '@/services/deposit-accounts'

/**
 * Who may pay into the user's standing Pix code, in the line the account screens use
 * (`depositAccounts.senderLimit`). The standing code is the user's BRL account, and the account
 * says it (`matching.sender`), as its bank details do: the Pix answer carries no payer rule. Before
 * the first code opens the account, the terms the account would carry stand in. Undefined while
 * the read is out, and where the account takes a Pix from anyone.
 */
export function usePixStandingPayerLine(enabled: boolean): string | undefined {
    const t = useTranslations('depositAccounts')
    const { userId } = useAuth()
    // the account lists' own read, so they share one answer
    const { data } = useQuery({
        queryKey: [...DEPOSIT_ACCOUNTS_QUERY_KEY, userId],
        queryFn: fetchDepositAccounts,
        enabled: !!userId && enabled,
    })
    const isPix = (railId: string) => corridorFromRailId(railId) === PIX_METHOD
    const matching =
        data?.accounts.find((account) => isPix(account.railId) && holdsSlot(account))?.matching ??
        data?.claimable.find((corridor) => isPix(corridor.railId))?.matching
    const key = matching ? senderLimitKey(matching) : undefined
    return key ? t(`senderLimit.${key}.line`) : undefined
}

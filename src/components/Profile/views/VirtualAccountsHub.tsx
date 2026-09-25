'use client'

import { AccountsHubList } from '@/features/deposit-accounts/components/AccountsHubList'
import { isHeld } from '@/features/deposit-accounts/resolveScreen'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { withReturnTo } from '@/utils/return-to.utils'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'

/**
 * The shared list with the virtual accounts read, for Accounts and payments.
 *
 * Mounted only while the accounts rollout flag is on, so `useDepositAccounts`
 * never fires otherwise (pinned by `UnlockPayments.test.tsx`: "does not query
 * bank accounts while their rollout flag is off"). A tap opens the account's
 * details, or the way to open it, in the Add money flow, and back returns here.
 */
export default function VirtualAccountsHub(
    props: Omit<ComponentProps<typeof AccountsHubList>, 'accounts' | 'claimsEnabled'>
) {
    const { corridors, accounts, claimable, unavailable, slotsHeld, accountLimit, gates, isLoading, isError, refetch } =
        useDepositAccounts()
    const router = useRouter()

    return (
        <AccountsHubList
            {...props}
            claimsEnabled
            accounts={{
                corridors,
                accounts,
                claimable,
                unavailable,
                slotsHeld,
                accountLimit,
                gates,
                isLoading,
                isError,
                onRetry: refetch,
                onOpen: (corridor) =>
                    router.push(
                        withReturnTo(
                            `/add-money?method=bank&step=${isHeld(accounts[corridor]) ? 'details' : 'claim'}&corridor=${corridor}`,
                            '/profile/accounts-and-payments'
                        )
                    ),
            }}
        />
    )
}

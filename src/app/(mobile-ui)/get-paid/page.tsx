'use client'

import { DepositAccountsFlow } from '@/features/deposit-accounts/components/DepositAccountsFlow'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { useDepositGateRemediation } from '@/features/deposit-accounts/useDepositGateRemediation'
import { useAuth } from '@/context/authContext'
import { useSafeBack } from '@/hooks/useSafeBack'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { useRouter } from 'next/navigation'
import { parseAsString, useQueryState } from 'nuqs'
import { useEffect } from 'react'

/** the one-off bank deposit, which works today on every corridor this flow serves */
const ONE_OFF_TRANSFER_HREF = '/add-money?method=bank'

/**
 * Get paid — bank details the user holds and hands to whoever pays them.
 *
 * Everything the screens read comes from `GET /users/deposit-accounts` and
 * from the capability gate every other bank surface uses, asked one corridor
 * at a time. The flow itself is the same component the design harness at
 * /dev/deposit-accounts renders, so the two cannot drift.
 *
 * Behind the `deposit-accounts` flag: while it is off, anyone who reaches this
 * route by link goes to the bank flow that does work today.
 */
export default function GetPaidPage() {
    const enabled = useDepositAccountsEnabled()
    const { accounts, gates, isLoading, isError, claimingCorridor, claimError, claim, refetch } = useDepositAccounts()
    const { user } = useAuth()
    const { resolveGate, modals } = useDepositGateRemediation()
    const router = useRouter()

    // The flow is reached from the home Add drawer, from /request, and by
    // direct link. The caller can name where back should go; otherwise the
    // shared handler goes back through real history and falls back to /home.
    const [rawReturnTo] = useQueryState(RETURN_TO_PARAM, parseAsString)
    const returnTo = readReturnTo({ get: (key) => (key === RETURN_TO_PARAM ? rawReturnTo : null) }, '/get-paid')
    const safeBack = useSafeBack('/home')

    useEffect(() => {
        if (!enabled) router.replace(ONE_OFF_TRANSFER_HREF)
    }, [enabled, router])

    if (!enabled) return null

    return (
        <>
            <DepositAccountsFlow
                accounts={accounts}
                gates={gates}
                isLoading={isLoading}
                isError={isError}
                // the name a payer reads next to the details; the share copy only
                // uses it where the account is NOT in the user's own name
                userName={user?.user.fullName || user?.user.username || ''}
                claimingCorridor={claimingCorridor}
                claimError={claimError}
                onExit={() => (returnTo ? router.push(returnTo) : safeBack())}
                onClaim={claim}
                onResolveGate={resolveGate}
                onRetry={refetch}
            />
            {modals}
        </>
    )
}

'use client'

import { DepositAccountsFlow } from '@/features/deposit-accounts/components/DepositAccountsFlow'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useSafeBack } from '@/hooks/useSafeBack'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { useRouter } from 'next/navigation'
import { parseAsString, useQueryState } from 'nuqs'

/**
 * Get paid — bank details the user holds and hands to whoever pays them.
 *
 * Everything the screens read comes from `GET /users/deposit-accounts` and
 * from the capability gate every other bank surface uses. The flow itself is
 * the same component the design harness at /dev/deposit-accounts renders, so
 * the two cannot drift.
 */
export default function GetPaidPage() {
    const { accounts, isLoading, gate, claimingCorridor, claimError, claim } = useDepositAccounts()
    const { user } = useAuth()
    const sumsubFlow = useMultiPhaseKycFlow({})
    const { setIsSupportModalOpen } = useModalsContext()
    const router = useRouter()

    // The flow is reached from the home Add drawer, from /request, and by
    // direct link. The caller can name where back should go; otherwise the
    // shared handler goes back through real history and falls back to /home.
    const [rawReturnTo] = useQueryState(RETURN_TO_PARAM, parseAsString)
    const returnTo = readReturnTo({ get: (key) => (key === RETURN_TO_PARAM ? rawReturnTo : null) }, '/get-paid')
    const safeBack = useSafeBack('/home')

    return (
        <DepositAccountsFlow
            accounts={accounts}
            isLoading={isLoading}
            // the name a payer reads next to the details; the share copy only
            // uses it where the account is NOT in the user's own name
            userName={user?.user.fullName || user?.user.username || ''}
            gate={gate}
            claimingCorridor={claimingCorridor}
            claimError={claimError}
            onExit={() => (returnTo ? router.push(returnTo) : safeBack())}
            onClaim={claim}
            // the gate says what is wrong; these are the two things a user can
            // do about it, and the banner picks between them by gate kind
            onResolveGate={() =>
                gate.kind === 'blocked-rejection' ? setIsSupportModalOpen(true) : void sumsubFlow.handleInitiateKyc()
            }
        />
    )
}

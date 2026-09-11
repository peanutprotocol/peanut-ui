'use client'

import { DepositAccountsFlow } from '@/features/deposit-accounts/components/DepositAccountsFlow'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'

/**
 * Get paid — bank details the user holds and hands to whoever pays them.
 *
 * Everything the screens read comes from `GET /users/deposit-accounts` and
 * from the capability gate every other bank surface uses. The flow itself is
 * the same component the design harness at /dev/deposit-accounts renders, so
 * the two cannot drift.
 */
export default function GetPaidPage() {
    const { accounts, gate, claimingCorridor, claimError, claim } = useDepositAccounts()
    const { user } = useAuth()
    const sumsubFlow = useMultiPhaseKycFlow({})
    const { setIsSupportModalOpen } = useModalsContext()

    return (
        <DepositAccountsFlow
            accounts={accounts}
            // the name a payer reads next to the details; the share copy only
            // uses it where the account is NOT in the user's own name
            userName={user?.user.fullName || user?.user.username || ''}
            gate={gate}
            claimingCorridor={claimingCorridor}
            claimError={claimError}
            onClaim={claim}
            // the gate says what is wrong; these are the two things a user can
            // do about it, and the banner picks between them by gate kind
            onResolveGate={() =>
                gate.kind === 'blocked-rejection' ? setIsSupportModalOpen(true) : void sumsubFlow.handleInitiateKyc()
            }
        />
    )
}

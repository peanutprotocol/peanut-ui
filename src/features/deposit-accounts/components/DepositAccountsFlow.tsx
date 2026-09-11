'use client'

import { useQueryStates } from 'nuqs'
import { DEPOSIT_ACCOUNT_PARAMS } from '../params'
import { DEPOSIT_RAILS, isClaimable } from '../rails'
import type { DepositAccount, DepositCorridor, ReturnedPayment } from '../types'
import { ClaimAccountScreen } from './ClaimAccountScreen'
import { DepositAccountDetailsScreen } from './DepositAccountDetailsScreen'
import { DepositAccountsListScreen } from './DepositAccountsListScreen'
import { ShareDepositDetailsScreen } from './ShareDepositDetailsScreen'

export interface DepositAccountsFlowProps {
    accounts: Record<DepositCorridor, DepositAccount | undefined>
    userName: string
    kycGate: boolean
    claimingCorridor?: DepositCorridor
    claimError?: string
    returnedPayment?: ReturnedPayment
    onClaim: (corridor: DepositCorridor) => void
    onVerify: () => void
}

/**
 * The get-paid flow: one NavHeader title across every step, the step in the
 * URL, in-flow back through `onPrev`. Which screen a corridor opens on is a
 * property of the account, not a separate route — an unclaimed corridor
 * opens the claim step, a held one opens its details.
 */
export function DepositAccountsFlow({
    accounts,
    userName,
    kycGate,
    claimingCorridor,
    claimError,
    returnedPayment,
    onClaim,
    onVerify,
}: DepositAccountsFlowProps) {
    const [{ screen, corridor }, setParams] = useQueryStates(DEPOSIT_ACCOUNT_PARAMS)
    const rail = DEPOSIT_RAILS[corridor]
    const account = accounts[corridor]

    const openCorridor = (next: DepositCorridor) => {
        const nextAccount = accounts[next]
        // only a corridor a user can hold has something to claim; the rest go
        // straight to their details, which are the user's own top-up details
        const needsClaim = isClaimable(DEPOSIT_RAILS[next]) && (!nextAccount || nextAccount.status === 'unclaimed')
        setParams({ corridor: next, screen: needsClaim ? 'claim' : 'details' })
    }

    if (screen === 'claim' && isClaimable(rail)) {
        return (
            <ClaimAccountScreen
                rail={rail}
                isClaiming={claimingCorridor === corridor}
                error={claimError}
                onClaim={() => {
                    onClaim(corridor)
                    setParams({ screen: 'details' })
                }}
                onBack={() => setParams({ screen: 'list' })}
            />
        )
    }

    if (screen === 'details' && account) {
        return (
            <DepositAccountDetailsScreen
                rail={rail}
                account={account}
                userName={userName}
                returnedPayment={returnedPayment}
                onBack={() => setParams({ screen: 'list' })}
                onShare={() => setParams({ screen: 'share' })}
                onRetry={() => onClaim(corridor)}
            />
        )
    }

    if (screen === 'share' && account) {
        return (
            <ShareDepositDetailsScreen
                rail={rail}
                account={account}
                userName={userName}
                onBack={() => setParams({ screen: 'details' })}
            />
        )
    }

    return <DepositAccountsListScreen accounts={accounts} kycGate={kycGate} onOpen={openCorridor} onVerify={onVerify} />
}

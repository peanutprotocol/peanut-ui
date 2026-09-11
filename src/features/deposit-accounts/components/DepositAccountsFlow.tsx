'use client'

import type { GateState } from '@/utils/capability-gate'
import { useQueryStates } from 'nuqs'
import { DEPOSIT_ACCOUNT_PARAMS } from '../params'
import { DEPOSIT_RAILS, isClaimable } from '../rails'
import { resolveScreen } from '../resolveScreen'
import type { DepositAccount, DepositCorridor, ReturnedPayment } from '../types'
import { ClaimAccountScreen } from './ClaimAccountScreen'
import { DepositAccountDetailsScreen } from './DepositAccountDetailsScreen'
import { DepositAccountsListScreen } from './DepositAccountsListScreen'
import { ShareDepositDetailsScreen } from './ShareDepositDetailsScreen'

export interface DepositAccountsFlowProps {
    accounts: Record<DepositCorridor, DepositAccount | undefined>
    userName: string
    /** `gateFor('deposit', { channel: 'bank' })` — the app primitive, passed through */
    gate: GateState
    claimingCorridor?: DepositCorridor
    claimError?: string
    returnedPayment?: ReturnedPayment
    onClaim: (corridor: DepositCorridor) => void
    onResolveGate: () => void
}

/**
 * The get-paid flow: one NavHeader title across every step, the step in the
 * URL, in-flow back through `onPrev`.
 *
 * Which screen renders is resolved from the gate and the account rather than
 * read off the URL — see `resolveScreen`. The claim step also stays on screen
 * until an account exists, so a provisioning failure has somewhere to be
 * shown instead of dropping the user back on the list with no explanation.
 */
export function DepositAccountsFlow({
    accounts,
    userName,
    gate,
    claimingCorridor,
    claimError,
    returnedPayment,
    onClaim,
    onResolveGate,
}: DepositAccountsFlowProps) {
    const [{ screen, corridor }, setParams] = useQueryStates(DEPOSIT_ACCOUNT_PARAMS)
    const rail = DEPOSIT_RAILS[corridor]
    const account = accounts[corridor]
    const resolved = resolveScreen(screen, rail, account, gate)

    const openCorridor = (next: DepositCorridor) => {
        const nextAccount = accounts[next]
        // only a corridor a user can hold has something to claim; the rest go
        // straight to their details, which are the user's own top-up details
        const needsClaim = isClaimable(DEPOSIT_RAILS[next]) && (!nextAccount || nextAccount.status === 'unclaimed')
        setParams({ corridor: next, screen: needsClaim ? 'claim' : 'details' })
    }

    if (resolved === 'claim') {
        return (
            <ClaimAccountScreen
                rail={rail}
                isClaiming={claimingCorridor === corridor}
                error={claimError}
                // no screen change here: once the account exists, resolveScreen
                // moves the user on by itself, and if it never does the error
                // renders on this screen rather than nowhere
                onClaim={() => onClaim(corridor)}
                onBack={() => setParams({ screen: 'list' })}
            />
        )
    }

    if (resolved === 'details' && account) {
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

    if (resolved === 'share' && account) {
        return (
            <ShareDepositDetailsScreen
                rail={rail}
                account={account}
                userName={userName}
                onBack={() => setParams({ screen: 'details' })}
            />
        )
    }

    return (
        <DepositAccountsListScreen
            accounts={accounts}
            gate={gate}
            onOpen={openCorridor}
            onResolveGate={onResolveGate}
        />
    )
}

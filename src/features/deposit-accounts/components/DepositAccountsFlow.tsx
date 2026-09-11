'use client'

import type { GateState } from '@/utils/capability-gate'
import { useQueryStates } from 'nuqs'
import { DEPOSIT_ACCOUNT_PARAMS } from '../params'
import { DEPOSIT_RAILS, isClaimable } from '../rails'
import { resolveScreen } from '../resolveScreen'
import type { DepositAccount, DepositCorridor, ReturnedPayment } from '../types'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { ClaimAccountScreen } from './ClaimAccountScreen'
import { DepositDetailsSkeleton } from './DepositDetailsSkeleton'
import { DepositAccountDetailsScreen } from './DepositAccountDetailsScreen'
import { DepositAccountsListScreen } from './DepositAccountsListScreen'
import { ShareDepositDetailsScreen } from './ShareDepositDetailsScreen'

export interface DepositAccountsFlowProps {
    accounts: Record<DepositCorridor, DepositAccount | undefined>
    /** true until the held accounts are known — the corridor list is local, they are not */
    isLoading?: boolean
    userName: string
    /** `gateFor('deposit', { channel: 'bank' })` — the app primitive, passed through */
    gate: GateState
    claimingCorridor?: DepositCorridor
    claimError?: string
    returnedPayment?: ReturnedPayment
    /** leaving the flow entirely — the list is a destination now, not a tab root */
    onExit: () => void
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
    isLoading = false,
    userName,
    gate,
    claimingCorridor,
    claimError,
    returnedPayment,
    onExit,
    onClaim,
    onResolveGate,
}: DepositAccountsFlowProps) {
    const [{ screen, corridor }, setParams] = useQueryStates(DEPOSIT_ACCOUNT_PARAMS)
    const { t } = useDepositAccountCopy()
    const rail = DEPOSIT_RAILS[corridor]
    const account = accounts[corridor]
    const resolved = resolveScreen(screen, rail, account, gate)

    // Which screen is right depends on whether the user already holds this
    // corridor, and that is a network answer. Resolving before it arrives reads
    // a missing account as "not claimed yet" and offers to open one the user may
    // already have — so a deep link to your own details would show the claim
    // screen first. The list has its own loading state and keeps it.
    if (isLoading && resolved !== 'list') {
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onExit} />
                <div className="flex flex-col gap-6">
                    <DepositDetailsSkeleton rows={rail.detailRowCount} withNotice />
                </div>
            </PageStack>
        )
    }

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
            isLoading={isLoading}
            gate={gate}
            onBack={onExit}
            onOpen={openCorridor}
            onResolveGate={onResolveGate}
        />
    )
}

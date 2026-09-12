'use client'

import type { GateState } from '@/utils/capability-gate'
import { useQueryStates } from 'nuqs'
import { useEffect } from 'react'
import { trackDetailsViewed, trackGateBlocked } from '../analytics'
import { DEPOSIT_ACCOUNT_PARAMS } from '../params'
import { DEPOSIT_RAILS, isClaimable } from '../rails'
import { resolveScreen } from '../resolveScreen'
import type { DepositAccount, DepositCorridor } from '../types'
import type { DepositClaimError } from '../useDepositAccounts'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import NavHeader from '@/components/Global/NavHeader'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { ClaimAccountScreen } from './ClaimAccountScreen'
import { DepositDetailsSkeleton } from './DepositDetailsSkeleton'
import { DepositAccountDetailsScreen } from './DepositAccountDetailsScreen'
import { DepositAccountsListScreen } from './DepositAccountsListScreen'
import { ShareDepositDetailsScreen } from './ShareDepositDetailsScreen'

export interface DepositAccountsFlowProps {
    accounts: Record<DepositCorridor, DepositAccount | undefined>
    /** `gateFor('deposit', { railId })` per corridor — the app primitive, one rail at a time */
    gates: Record<DepositCorridor, GateState>
    /** true until the held accounts are known — the corridor list is local, they are not */
    isLoading?: boolean
    /** the accounts could not be read; the list says so instead of offering claims */
    isError?: boolean
    userName: string
    claimingCorridor?: DepositCorridor
    claimError?: DepositClaimError
    /** leaving the flow entirely — the list is a destination now, not a tab root */
    onExit: () => void
    onClaim: (corridor: DepositCorridor) => void
    onResolveGate: (gate: GateState) => void
    onRetry: () => void
}

/**
 * The get-paid flow: one NavHeader title across every step, the step in the
 * URL, in-flow back through `onPrev`.
 *
 * Which screen renders is resolved from the SELECTED corridor's gate and its
 * account rather than read off the URL — see `resolveScreen`. The claim step
 * also stays on screen until an account exists, so a provisioning failure has
 * somewhere to be shown instead of dropping the user back on the list with no
 * explanation.
 */
export function DepositAccountsFlow({
    accounts,
    gates,
    isLoading = false,
    isError = false,
    userName,
    claimingCorridor,
    claimError,
    onExit,
    onClaim,
    onResolveGate,
    onRetry,
}: DepositAccountsFlowProps) {
    const [{ step: screen, corridor, screen: legacyStep }, setParams] = useQueryStates(DEPOSIT_ACCOUNT_PARAMS)
    // Links minted while the cursor was called `?screen=` still open the flow
    // where they meant to. Rewritten once, in place, so back does not land on
    // the old name.
    useEffect(() => {
        if (legacyStep) setParams({ step: legacyStep, screen: null })
    }, [legacyStep, setParams])
    const { t, railName } = useDepositAccountCopy()
    const rail = DEPOSIT_RAILS[corridor]
    const account = accounts[corridor]
    const gate = gates[corridor]
    // A read that failed says nothing about what the user holds, so a deep link
    // must not resolve past the list: the empty fallback map would read as "not
    // claimed yet" and offer to open an account the user may already have. The
    // list carries the error and the retry.
    const resolved = isError ? 'list' : resolveScreen(screen, rail, account, gate)

    // A user who asked for a screen and was handed a lesser one hit the gate.
    // Reported per corridor and per gate kind, because "blocked" as one number
    // cannot tell a queue waiting on a provider from users with a button to press.
    const gateBlocked = !isLoading && !isError && screen !== 'list' && resolved !== screen && gate.kind !== 'ready'
    useEffect(() => {
        if (gateBlocked) trackGateBlocked(corridor, gate.kind)
    }, [gateBlocked, corridor, gate.kind])

    const viewedStatus = resolved === 'details' && account ? account.status : undefined
    useEffect(() => {
        if (viewedStatus) trackDetailsViewed(corridor, viewedStatus)
    }, [viewedStatus, corridor])

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
                    {/* Real heading and status line — only the card underneath is a
                        skeleton, so a claimed corridor reads as "your account is
                        coming" rather than an unlabelled loading box. */}
                    <TitleBlock
                        size="s"
                        title={t('details.heading', { currency: rail.currency, rail: railName(rail.corridor) })}
                        description={t('details.provisioning', { currency: rail.currency })}
                    />
                    <DepositDetailsSkeleton rows={rail.detailRowCount} />
                </div>
            </PageStack>
        )
    }

    const openCorridor = (next: DepositCorridor) => {
        const nextAccount = accounts[next]
        // only a corridor a user can hold has something to claim; the rest go
        // straight to their details, which are the user's own top-up details
        const needsClaim = isClaimable(DEPOSIT_RAILS[next]) && (!nextAccount || nextAccount.status === 'unclaimed')
        setParams({ corridor: next, step: needsClaim ? 'claim' : 'details' })
    }

    if (resolved === 'claim') {
        return (
            <ClaimAccountScreen
                rail={rail}
                isClaiming={claimingCorridor === corridor}
                // a failure on another corridor is not this screen's news
                error={claimError?.corridor === corridor ? claimError.message : undefined}
                // no screen change here: once the account exists, resolveScreen
                // moves the user on by itself, and if it never does the error
                // renders on this screen rather than nowhere
                onClaim={() => onClaim(corridor)}
                onBack={() => setParams({ step: 'list' })}
            />
        )
    }

    if (resolved === 'details' && account) {
        return (
            <DepositAccountDetailsScreen
                rail={rail}
                account={account}
                userName={userName}
                onBack={() => setParams({ step: 'list' })}
                onShare={() => setParams({ step: 'share' })}
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
                onBack={() => setParams({ step: 'details' })}
            />
        )
    }

    return (
        <DepositAccountsListScreen
            accounts={accounts}
            gates={gates}
            isLoading={isLoading}
            isError={isError}
            onBack={onExit}
            onOpen={openCorridor}
            onResolveGate={onResolveGate}
            onRetry={onRetry}
        />
    )
}

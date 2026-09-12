'use client'

import { useCapabilities } from '@/hooks/useCapabilities'
import { claimDepositAccount, fetchDepositAccounts } from '@/services/deposit-accounts'
import type { GateState } from '@/utils/capability-gate'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { trackClaimFailed, trackClaimStarted } from './analytics'
import { mantecaArgentinaAccount, mantecaBrazilAccount } from './mantecaCorridors'
import { DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER, railIdFor } from './rails'
import type { DepositAccount, DepositCorridor } from './types'

export const DEPOSIT_ACCOUNTS_QUERY_KEY = ['deposit-accounts'] as const

/** how long a provisioning account is given before the screen stops waiting */
export const PROVISIONING_POLL_MS = 5_000
export const MAX_PROVISIONING_POLLS = 24

/** the corridor a claim failed on, so a stale error cannot be shown on another */
export interface DepositClaimError {
    corridor: DepositCorridor
    message: string
}

export interface UseDepositAccountsResult {
    accounts: Record<DepositCorridor, DepositAccount | undefined>
    /** the capability gate for EACH corridor, asked one rail id at a time */
    gates: Record<DepositCorridor, GateState>
    isLoading: boolean
    /** the accounts could not be read — distinct from "you hold none" */
    isError: boolean
    claimingCorridor?: DepositCorridor
    claimError?: DepositClaimError
    claim: (corridor: DepositCorridor) => void
    refetch: () => void
}

/**
 * Everything the get-paid flow needs, from the places that own it: the
 * accounts from the backend, and whether the user may deposit on each corridor
 * from the capability gate every other bank surface uses.
 *
 * A provisioning account refetches on a short interval — the provider usually
 * takes under a minute, and the alternative is a user staring at a skeleton
 * that never resolves until they navigate away and back. The interval is
 * capped: past two minutes the provider is not coming back on its own, and an
 * uncapped 5s poll on a phone left open is a battery bill with no answer at
 * the end of it. The corridor reads as failed then, which is the one state
 * with a retry on it.
 */
export function useDepositAccounts(): UseDepositAccountsResult {
    const queryClient = useQueryClient()
    const { gateFor } = useCapabilities()
    const [claimingCorridor, setClaimingCorridor] = useState<DepositCorridor | undefined>()
    const [claimError, setClaimError] = useState<DepositClaimError | undefined>()

    // answers that still said "provisioning", counted since the last one that
    // did not — the poll's budget, and what turns the wait into a failure
    const [provisioningPolls, setProvisioningPolls] = useState(0)

    const query = useQuery({
        queryKey: DEPOSIT_ACCOUNTS_QUERY_KEY,
        queryFn: fetchDepositAccounts,
        refetchInterval: (q) =>
            provisioningPolls < MAX_PROVISIONING_POLLS && hasProvisioning(q.state.data) ? PROVISIONING_POLL_MS : false,
    })

    const { dataUpdatedAt } = query
    useEffect(() => {
        if (!dataUpdatedAt) return
        setProvisioningPolls((polls) => (hasProvisioning(query.data) ? polls + 1 : 0))
        // one bump per answer from the server, not per render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataUpdatedAt])

    const provisioningTimedOut = provisioningPolls >= MAX_PROVISIONING_POLLS

    const claim = useMutation({
        mutationFn: claimDepositAccount,
        onMutate: (method: string) => {
            const corridor = method as DepositCorridor
            // a fresh attempt owns the error slot: the previous corridor's
            // failure must not sit on this screen while this one is in flight
            setClaimError(undefined)
            setClaimingCorridor(corridor)
            // a retry buys the new account its own budget
            setProvisioningPolls(0)
            trackClaimStarted(corridor)
        },
        onError: (error: Error, method: string) => {
            const corridor = method as DepositCorridor
            setClaimError({ corridor, message: error.message })
            trackClaimFailed(corridor, error.message)
        },
        onSettled: async () => {
            setClaimingCorridor(undefined)
            await queryClient.invalidateQueries({ queryKey: DEPOSIT_ACCOUNTS_QUERY_KEY })
        },
    })

    /**
     * The corridor map the screens read. Bridge corridors come from the
     * backend; Manteca's two are assembled here because they are not accounts
     * anybody holds — both mint their coordinates per deposit, so there is
     * nothing per-user to store and nothing standing to fetch.
     *
     * One corridor can carry several accounts during a provider rotation: the
     * new one and the retiring predecessor it replaces. `isPrimary` names the
     * details a NEW payer should be given, so it decides — response order must
     * not, or a rotation can put retired details in a payroll form.
     */
    const accounts = useMemo((): Record<DepositCorridor, DepositAccount | undefined> => {
        const byCorridor: Record<DepositCorridor, DepositAccount | undefined> = {
            ACH_US: undefined,
            SEPA_EU: undefined,
            FASTER_PAYMENTS_GB: undefined,
            SPEI_MX: undefined,
            PIX_BR: mantecaBrazilAccount(),
            BANK_TRANSFER_AR: mantecaArgentinaAccount(),
        }
        for (const account of query.data ?? []) {
            const corridor = corridorFromRailId(account.railId)
            if (!corridor) continue
            // The wait is over and the provider never answered. `failed` is the
            // honest name for it AND the only state the details screen offers a
            // retry on — a skeleton that stopped refreshing offers nothing.
            const resolved =
                provisioningTimedOut && account.status === 'provisioning'
                    ? { ...account, status: 'failed' as const }
                    : account
            byCorridor[corridor] = preferred(byCorridor[corridor], resolved)
        }
        return byCorridor
    }, [query.data, provisioningTimedOut])

    const gates = useMemo((): Record<DepositCorridor, GateState> => {
        const out = {} as Record<DepositCorridor, GateState>
        for (const corridor of DEPOSIT_RAIL_ORDER) {
            // railId, not { channel: 'bank' }: a channel-wide gate answers
            // "ready" as soon as ANY bank rail is enabled, so one working
            // Manteca rail was unlocking four Bridge corridors the user has no
            // rail for at all. A corridor with no rail in the capability block
            // resolves to needs-identity / needs-enrollment, which is the
            // honest answer.
            out[corridor] = gateFor('deposit', { railId: railIdFor(corridor) })
        }
        return out
    }, [gateFor])

    const doClaim = useCallback((corridor: DepositCorridor) => claim.mutate(corridor), [claim])

    return {
        accounts,
        gates,
        isLoading: query.isLoading,
        isError: query.isError,
        claimingCorridor,
        claimError,
        claim: doClaim,
        refetch: () => {
            setProvisioningPolls(0)
            void query.refetch()
        },
    }
}

function hasProvisioning(accounts: DepositAccount[] | undefined): boolean {
    return (accounts ?? []).some((account) => account.status === 'provisioning')
}

/**
 * Which of two accounts on one corridor the screens should show.
 *
 * The primary wins outright. With no primary among them — a state the contract
 * allows and the backend should not produce — the one that is not retiring
 * wins, and only then does arrival order decide, so the worst case is
 * arbitrary rather than wrong.
 */
function preferred(current: DepositAccount | undefined, next: DepositAccount): DepositAccount {
    if (!current) return next
    if (next.isPrimary !== current.isPrimary) return next.isPrimary ? next : current
    const retiring = (account: DepositAccount) => account.status === 'retiring'
    if (retiring(current) !== retiring(next)) return retiring(current) ? next : current
    return current
}

/**
 * `bridge.ach_us` → `ACH_US`. The corridor key IS the rail method code in both
 * repos, so this only has to undo the provider prefix and the lower-casing the
 * capability contract applies to rail ids.
 */
export function corridorFromRailId(railId: string): DepositCorridor | undefined {
    const method = railId.split('.')[1]?.toUpperCase()
    return method && method in DEPOSIT_RAILS ? (method as DepositCorridor) : undefined
}

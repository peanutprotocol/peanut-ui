'use client'

import { useCapabilities } from '@/hooks/useCapabilities'
import { claimDepositAccount, fetchDepositAccounts } from '@/services/deposit-accounts'
import type { GateState } from '@/utils/capability-gate'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { trackClaimFailed, trackClaimStarted } from './analytics'
import { mantecaArgentinaAccount, mantecaBrazilAccount } from './mantecaCorridors'
import { DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER, railIdFor } from './rails'
import type { DepositAccount, DepositCorridor } from './types'

export const DEPOSIT_ACCOUNTS_QUERY_KEY = ['deposit-accounts'] as const

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
 * that never resolves until they navigate away and back.
 */
export function useDepositAccounts(): UseDepositAccountsResult {
    const queryClient = useQueryClient()
    const { gateFor } = useCapabilities()
    const [claimingCorridor, setClaimingCorridor] = useState<DepositCorridor | undefined>()
    const [claimError, setClaimError] = useState<DepositClaimError | undefined>()

    const query = useQuery({
        queryKey: DEPOSIT_ACCOUNTS_QUERY_KEY,
        queryFn: fetchDepositAccounts,
        refetchInterval: (q) =>
            (q.state.data ?? []).some((account) => account.status === 'provisioning') ? 5_000 : false,
    })

    const claim = useMutation({
        mutationFn: claimDepositAccount,
        onMutate: (method: string) => {
            const corridor = method as DepositCorridor
            // a fresh attempt owns the error slot: the previous corridor's
            // failure must not sit on this screen while this one is in flight
            setClaimError(undefined)
            setClaimingCorridor(corridor)
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
            if (corridor) byCorridor[corridor] = preferred(byCorridor[corridor], account)
        }
        return byCorridor
    }, [query.data])

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
        refetch: () => void query.refetch(),
    }
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

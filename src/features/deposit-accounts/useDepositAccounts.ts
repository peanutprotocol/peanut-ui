'use client'

import { useCapabilities } from '@/hooks/useCapabilities'
import { claimDepositAccount, fetchDepositAccounts } from '@/services/deposit-accounts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { mantecaArgentinaAccount, mantecaBrazilAccount } from './mantecaCorridors'
import { DEPOSIT_RAILS } from './rails'
import type { DepositAccount, DepositCorridor } from './types'

export const DEPOSIT_ACCOUNTS_QUERY_KEY = ['deposit-accounts'] as const

/**
 * Everything the get-paid flow needs, from the places that own it: the
 * accounts from the backend, and whether the user may deposit at all from the
 * capability gate every other bank surface uses.
 *
 * A provisioning account refetches on a short interval — the provider usually
 * takes under a minute, and the alternative is a user staring at a skeleton
 * that never resolves until they navigate away and back.
 */
export function useDepositAccounts() {
    const queryClient = useQueryClient()
    const { gateFor } = useCapabilities()
    const [claimingCorridor, setClaimingCorridor] = useState<DepositCorridor | undefined>()

    const query = useQuery({
        queryKey: DEPOSIT_ACCOUNTS_QUERY_KEY,
        queryFn: fetchDepositAccounts,
        refetchInterval: (q) =>
            (q.state.data ?? []).some((account) => account.status === 'provisioning') ? 5_000 : false,
    })

    const claim = useMutation({
        mutationFn: claimDepositAccount,
        onMutate: (method: string) => setClaimingCorridor(method as DepositCorridor),
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
     */
    const accounts = useCallback((): Record<DepositCorridor, DepositAccount | undefined> => {
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
            if (corridor) byCorridor[corridor] = account
        }
        return byCorridor
    }, [query.data])

    return {
        accounts: accounts(),
        isLoading: query.isLoading,
        gate: gateFor('deposit', { channel: 'bank' }),
        claimingCorridor,
        claimError: claim.error?.message,
        claim: (corridor: DepositCorridor) => claim.mutate(corridor),
        refetch: query.refetch,
    }
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

'use client'

import { currencyAccountsKey, eurcBalanceQueryOptions } from '@/utils/currency-account-queries'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { currencyAccountsApi, type CurrencyAccount, type CurrencyAccountsResponse } from '@/services/currency-accounts'

export function useCurrencyAccounts(userId: string | undefined) {
    const queryClient = useQueryClient()
    const query = useQuery({
        queryKey: currencyAccountsKey(userId),
        queryFn: currencyAccountsApi.list,
        enabled: !!userId,
        staleTime: 30_000,
        retry: 1,
    })
    const add = useMutation({
        // Capture the owner in the mutation variables. A completion after logout
        // must never insert the old user's account into the new user's cache.
        mutationFn: (_owner: string) => currencyAccountsApi.addEurc(),
        onSuccess: (account, owner) => {
            queryClient.setQueryData<CurrencyAccountsResponse>(currencyAccountsKey(owner), (previous) => ({
                accounts: [...(previous?.accounts ?? []).filter((a) => a.asset !== account.asset), account],
                available: (previous?.available ?? []).filter((a) => a.asset !== account.asset),
            }))
            void queryClient.invalidateQueries({ queryKey: currencyAccountsKey(owner) })
        },
    })
    return { ...query, add }
}

export function useEurcBalance(userId: string | undefined, account: CurrencyAccount | undefined) {
    return useQuery(eurcBalanceQueryOptions(userId, account))
}

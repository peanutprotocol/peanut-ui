'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPublicClient } from '@/app/actions/clients'
import { currencyAccountsApi, type CurrencyAccount, type CurrencyAccountsResponse } from '@/services/currency-accounts'
import { erc20Abi, isAddress, type Address } from 'viem'
import { EURC_ASSET } from '@/constants/currency-accounts.consts'
import { isDemoMode } from '@/utils/demo'
import { peekActiveFixture } from '@/dev/fixtures/active'

export const currencyAccountsKey = (userId: string | undefined) => ['currency-accounts', userId] as const

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

/** Dedicated key/reader: EURC is six-decimal euro units, never USDC/Rain spending power. */
export const eurcBalanceQueryOptions = (userId: string | undefined, account: CurrencyAccount | undefined) => ({
    queryKey: ['currency-account-balance', userId, account?.chainId, account?.tokenAddress, account?.address] as const,
    queryFn: async (): Promise<bigint> => {
        if (
            !account ||
            account.asset !== 'EURC' ||
            account.currency !== 'EUR' ||
            account.chainId !== EURC_ASSET.chainId ||
            account.tokenAddress.toLowerCase() !== EURC_ASSET.tokenAddress ||
            account.decimals !== EURC_ASSET.decimals ||
            !isAddress(account.address)
        ) {
            throw new Error('Unsupported EURC account')
        }
        // Fixtures and native demo are fully synthetic; never query a funded
        // wallet or RPC for their euro balance.
        if (isDemoMode() || peekActiveFixture()) return 0n
        return getPublicClient(8453).readContract({
            address: account.tokenAddress as Address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account.address as Address],
        })
    },
    enabled: !!userId && !!account,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 2,
})

export function useEurcBalance(userId: string | undefined, account: CurrencyAccount | undefined) {
    return useQuery(eurcBalanceQueryOptions(userId, account))
}

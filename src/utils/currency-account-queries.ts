import { getPublicClient } from '@/app/actions/clients'
import type { CurrencyAccount } from '@/services/currency-accounts'
import { erc20Abi, isAddress, type Address } from 'viem'
import { EURC_ASSET, EURE_ASSET } from '@/constants/currency-accounts.consts'
import { isDemoMode } from '@/utils/demo'
import { peekActiveFixture } from '@/dev/fixtures/active'

export const currencyAccountsKey = (userId: string | undefined) => ['currency-accounts', userId] as const

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

export const eureBalanceQueryOptions = (userId: string | undefined, account: CurrencyAccount | undefined) => ({
    queryKey: ['currency-account-balance', userId, account?.chainId, account?.tokenAddress, account?.address] as const,
    queryFn: async (): Promise<bigint> => {
        if (
            !account ||
            account.asset !== EURE_ASSET.asset ||
            account.currency !== EURE_ASSET.currency ||
            account.chainId !== EURE_ASSET.chainId ||
            account.tokenAddress.toLowerCase() !== EURE_ASSET.tokenAddress ||
            account.decimals !== EURE_ASSET.decimals ||
            !isAddress(account.address)
        ) {
            throw new Error('Unsupported EUR account')
        }
        if (isDemoMode() || peekActiveFixture()) return 0n
        return getPublicClient(EURE_ASSET.chainId === '421614' ? 421614 : 42161).readContract({
            address: EURE_ASSET.tokenAddress,
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

'use server'

import { getSquidChains, getSquidTokens } from '@squirrel-labs/peanut-sdk'
import { unstable_cache } from 'next/cache'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { supportedPeanutChains } from '@/constants'

const supportedByPeanut = (chain: interfaces.ISquidChain): boolean =>
    'evm' === chain.chainType &&
    supportedPeanutChains.some((supportedChain) => supportedChain.chainId === chain.chainId)

const tokensSupportedByPeanut = (token: interfaces.ISquidToken): boolean =>
    supportedPeanutChains.some((supportedChain) => supportedChain.chainId === token.chainId)

const getSquidChainsCache = unstable_cache(
    async () => {
        const chains = await getSquidChains({ isTestnet: false })
        return chains.filter(supportedByPeanut)
    },
    ['getSquidChains'],
    {
        revalidate: 3600 * 12,
    }
)
const getSquidTokensCache = unstable_cache(
    async () => {
        const tokens = await getSquidTokens({ isTestnet: false })
        return tokens.filter(tokensSupportedByPeanut)
    },
    ['getSquidTokens'],
    {
        revalidate: 3600 * 12,
    }
)

export const getSquidChainsAndTokens = unstable_cache(
    async (): Promise<Record<string, interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }>> => {
        const [chains, tokens] = await Promise.all([getSquidChainsCache(), getSquidTokensCache()])

        const chainsById = chains.reduce<Record<string, interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }>>(
            (acc, chain) => {
                acc[chain.chainId] = { ...chain, tokens: [] }
                return acc
            },
            {}
        )

        tokens.forEach((token) => {
            if (token.active && token.chainId in chainsById) {
                chainsById[token.chainId].tokens.push(token)
            }
        })

        return chainsById
    },
    ['getSquidChainsAndTokens'],
    { revalidate: 3600 * 12 }
)

'use server'

import { getSquidChains, getSquidTokens } from '@squirrel-labs/peanut-sdk'
import { unstable_cache } from 'next/cache'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { supportedPeanutChains } from '@/constants'

const getSquidChainsCache = unstable_cache(async () => await getSquidChains({ isTestnet: false }), ['getSquidChains'], {
    revalidate: 3600 * 12,
})
const getSquidTokensCache = unstable_cache(async () => await getSquidTokens({ isTestnet: false }), ['getSquidTokens'], {
    revalidate: 3600 * 12,
})

const supportedByPeanut = (chain: interfaces.ISquidChain): boolean =>
    'evm' === chain.chainType &&
    supportedPeanutChains.some((supportedChain) => supportedChain.chainId === chain.chainId)

export const getSquidChainsAndTokens = unstable_cache(
    async (): Promise<Record<string, interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }>> => {
        const [chains, tokens] = await Promise.all([getSquidChainsCache(), getSquidTokensCache()])

        const chainsById = chains
            .filter(supportedByPeanut)
            .reduce<Record<string, interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }>>((acc, chain) => {
                acc[chain.chainId] = { ...chain, tokens: [] }
                return acc
            }, {})

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

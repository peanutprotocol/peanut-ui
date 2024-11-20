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

export const getSquidChainsAndTokens = unstable_cache(
    async (): Promise<Record<string, interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }>> => {
        const chains = await getSquidChainsCache()
        const tokens = await getSquidTokensCache()

        const chainsById = chains
            .filter(
                (chain) =>
                    'evm' === chain.chainType &&
                    !!supportedPeanutChains.find((supportedChain) => supportedChain.chainId === chain.chainId)
            )
            .reduce(
                (acc, chain) => {
                    acc[chain.chainId] = chain
                    return acc
                },
                {} as Record<string, any>
            )

        tokens.forEach((token) => {
            if (token.active && token.chainId in chainsById) {
                if (!chainsById[token.chainId].tokens) {
                    chainsById[token.chainId].tokens = []
                }
                chainsById[token.chainId].tokens.push(token)
            }
        })

        return chainsById
    },
    ['getSquidChainsAndTokens'],
    { revalidate: 3600 * 12 }
)
/*
export async function getSquidChainsAndTokens(): Promise<Record<string, interfaces.ISquidChain & {tokens: interfaces.ISquidToken[]}>> {
  console.log('======= Fetching squid chains and tokens =======')
  const chains = await getSquidChainsCache()
  const tokens = await getSquidTokensCache()

  const chainsById = chains.filter(chain => 'evm' === chain.chainType)
    .reduce((acc, chain) => {
      acc[chain.chainId] = chain
      return acc
    }, {} as Record<string, any>)

  tokens.forEach(token => {
    if (token.chainId in chainsById) {
      if (!chainsById[token.chainId].tokens) {
        chainsById[token.chainId].tokens = []
      }
      chainsById[token.chainId].tokens.push(token)
    }
  })

  return chainsById
}
*/

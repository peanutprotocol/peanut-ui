'use server'
import { unstable_cache } from 'next/cache'
import type { PublicClient, Chain, Hash } from 'viem'
import { createPublicClient, http, extractChain } from 'viem'
import * as chains from 'viem/chains'
import { jsonStringify } from '@/utils'

import { PUBLIC_CLIENTS_BY_CHAIN, infuraRpcUrls } from '@/constants'

const allChains = Object.values(chains)
export type ChainId = (typeof allChains)[number]['id']

export type FeeOptions = {
    gas: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
}

export const getPublicClient = unstable_cache(
    async (chainId: ChainId): Promise<PublicClient> => {
        let client: PublicClient | undefined = PUBLIC_CLIENTS_BY_CHAIN[chainId]?.client
        if (client) return client
        const chain: Chain = extractChain({ chains: allChains, id: chainId })
        if (!chain) throw new Error(`No chain found for chainId ${chainId}`)
        return createPublicClient({
            transport: http(infuraRpcUrls[chainId]),
            chain,
        })
    },
    ['getPublicClient'],
    {
        tags: ['getPublicClient'],
    }
)

type PreparedTx = {
    account: Hash
    data: Hash
    to: Hash
    value: string
}
export const getFeeOptions = unstable_cache(
    async (chainId: ChainId, preparedTx: PreparedTx): Promise<string> => {
        const client = await getPublicClient(chainId)
        const [feeEstimates, gas] = await Promise.all([
            client.estimateFeesPerGas(),
            client.estimateGas({
                account: preparedTx.account,
                data: preparedTx.data,
                to: preparedTx.to,
                value: BigInt(preparedTx.value),
            }),
        ])
        return jsonStringify({
            gas,
            maxFeePerGas: feeEstimates.maxFeePerGas,
            maxPriorityFeePerGas: feeEstimates.maxPriorityFeePerGas,
        })
    },
    ['getFeeOptions'],
    {
        revalidate: 20, // revalidate every 20 seconds
        tags: ['getFeeOptions'],
    }
)

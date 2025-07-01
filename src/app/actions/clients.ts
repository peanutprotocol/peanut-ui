'use server'
import { unstable_cache } from 'next/cache'
import type { PublicClient, Chain, Hash } from 'viem'
import { createPublicClient, http, extractChain, maxUint256, keccak256, encodeAbiParameters, numberToHex } from 'viem'
import * as chains from 'viem/chains'
import { jsonStringify } from '@/utils'

import { PUBLIC_CLIENTS_BY_CHAIN, infuraRpcUrls } from '@/constants'

const allChains = Object.values(chains)
export type ChainId = (typeof allChains)[number]['id']

export type FeeOptions = {
    gas: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
    error?: string | null
}

export const getPublicClient = async (chainId: ChainId): Promise<PublicClient> => {
    let client: PublicClient | undefined = PUBLIC_CLIENTS_BY_CHAIN[chainId]?.client
    if (client) return client
    const chain: Chain = extractChain({ chains: allChains, id: chainId })
    if (!chain) throw new Error(`No chain found for chainId ${chainId}`)
    return createPublicClient({
        transport: http(infuraRpcUrls[chainId]),
        chain,
    })
}

export type PreparedTx = {
    account: Hash
    from?: Hash
    erc20Token?: Hash
    data: Hash
    to: Hash
    value: string
}
export const getFeeOptions = unstable_cache(
    async (chainId: ChainId, preparedTx: PreparedTx): Promise<string> => {
        try {
            const client = await getPublicClient(chainId)
            const fromAccount = preparedTx.from ?? preparedTx.account
            const [feeEstimates, gas] = await Promise.all([
                client.estimateFeesPerGas(),
                client.estimateGas({
                    account: fromAccount,
                    data: preparedTx.data,
                    to: preparedTx.to,
                    value: BigInt(preparedTx.value),
                    // Simulate max allowance to avoid reverts while estimating fees
                    stateOverride: preparedTx.erc20Token
                        ? [
                              {
                                  address: preparedTx.erc20Token,
                                  //Just put the allowance in all the possible slots (0-10)
                                  // Decided agains using the slotSeek library because
                                  // it's not widely used
                                  stateDiff: Array.from(Array(11).keys())
                                      .map(BigInt)
                                      .map((slotNumber) => ({
                                          slot: calculateAllowanceSlot(fromAccount, preparedTx.to, slotNumber),
                                          value: numberToHex(maxUint256),
                                      })),
                              },
                          ]
                        : [],
                }),
            ])
            return jsonStringify({
                gas: (gas * 140n) / 100n, // Add 40% to estimated gas
                maxFeePerGas: feeEstimates.maxFeePerGas,
                maxPriorityFeePerGas: feeEstimates.maxPriorityFeePerGas,
                error: null,
            })
        } catch (error) {
            console.error('Error estimating fees:', error)
            return jsonStringify({
                gas: null,
                maxFeePerGas: null,
                maxPriorityFeePerGas: null,
                error: (error as Error).message,
            })
        }
    },
    ['getFeeOptions'],
    {
        revalidate: 20, // revalidate every 20 seconds
        tags: ['getFeeOptions'],
    }
)

// Helper function to calculate allowance slot
// see: https://github.com/d3or/slotseek/blob/master/src/approval.ts
// If we find that this function doesnt work for some tokens, we will have to
// use slotseek itself
function calculateAllowanceSlot(owner: Hash, spender: Hash, slotNumber: bigint) {
    const slotHash = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [owner, slotNumber]))

    return keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }], [spender, slotHash]))
}

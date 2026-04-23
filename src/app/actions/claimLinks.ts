'use server'
import { unstable_cache } from 'next/cache'
import peanut, { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import type { Address, Hash } from 'viem'

import { getPublicClient, type ChainId } from '@/app/actions/clients'
import { getLinkFromReceipt } from '@/utils/general.utils'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'

export const getLinkFromTx = unstable_cache(
    async ({
        linkDetails,
        txHash,
        password,
    }: {
        linkDetails: peanutInterfaces.IPeanutLinkDetails
        txHash: string
        password: string
    }): Promise<string> => {
        const { chainId } = linkDetails
        const client = getPublicClient(Number(chainId) as ChainId)
        const txReceipt = await client.waitForTransactionReceipt({
            hash: txHash as `0x${string}`,
        })
        return getLinkFromReceipt({ txReceipt, linkDetails, password })
    },
    ['getLinkFromTx']
)

export async function getNextDepositIndex(contractVersion: string): Promise<number> {
    const publicClient = getPublicClient(PEANUT_WALLET_CHAIN.id)
    const contractAbi = peanut.getContractAbi(contractVersion)
    const contractAddress: Address = peanut.getContractAddress(
        PEANUT_WALLET_CHAIN.id.toString(),
        contractVersion
    ) as Hash
    return (await publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'getDepositCount',
        args: [],
    })) as number
}

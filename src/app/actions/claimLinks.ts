'use server'
import { unstable_cache } from 'next/cache'
import peanut, { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import type { Address, Hash } from 'viem'
import { getContract } from 'viem'

import { getPublicClient, type ChainId } from '@/app/actions/clients'
import { fetchTokenDetails } from '@/app/actions/tokens'
import { getLinkFromReceipt, fetchWithSentry, jsonParse } from '@/utils'
import { PEANUT_API_URL, PEANUT_WALLET_CHAIN } from '@/constants'
import type { SendLink } from '@/services/services.types'

export const getLinkDetails = unstable_cache(
    async (link: string): Promise<any> => {
        const params = peanut.getParamsFromLink(link)
        const chainId = params.chainId
        const contractVersion = params.contractVersion
        const depositIdx = params.depositIdx
        const client = getPublicClient(Number(chainId) as ChainId)
        const peanutContractAddress = peanut.getContractAddress(chainId, contractVersion) as Address
        const peanutContractAbi = peanut.getContractAbi(contractVersion)
        const contract = getContract({
            address: peanutContractAddress,
            abi: peanutContractAbi,
            client,
        })
        const rawDeposit: any = await contract.read.deposits([depositIdx])
        const deposit = {
            pubKey20: rawDeposit[0],
            amount: rawDeposit[1],
            tokenAddress: rawDeposit[2],
            contractType: rawDeposit[3],
            claimed: rawDeposit[4],
            requiresMFA: rawDeposit[5],
            timestamp: rawDeposit[6],
            tokenId: rawDeposit[7],
            senderAddress: rawDeposit[8],
        }
        if (!deposit) {
            throw new Error(`No deposit found for depositIdx ${depositIdx}`)
        }
        const tokenDetails = await fetchTokenDetails(deposit.tokenAddress, chainId)
        return peanut.extractLinkDetails({ params, deposit, tokenDetails })
    },
    ['getLinkDetails'],
    {
        revalidate: 5, // 5 seconds this is only useful for loading the page and avoid calling this twice on metadata and pageload
    }
)

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

export async function claimSendLink(
    pubKey: string,
    recipient: string,
    password: string,
    waitForTx: boolean,
    campaignTag?: string // optional campaign tag
): Promise<SendLink | { error: string }> {
    const response = await fetchWithSentry(`${PEANUT_API_URL}/send-links/${pubKey}/claim`, {
        method: 'POST',
        headers: {
            'api-key': process.env.PEANUT_API_KEY!,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient,
            password,
            waitForTx,
            campaignTag,
        }),
    })
    if (!response.ok) {
        const body = await response.json()
        if (!!body.error || !!body.message) {
            return { error: body.message ?? body.error }
        }
        return { error: `HTTP error! status: ${response.status}` }
    }
    return jsonParse(await response.text()) as SendLink
}

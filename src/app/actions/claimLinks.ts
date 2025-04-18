'use server'
import { unstable_cache } from 'next/cache'
import peanut, { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { type Address } from 'viem'
import { getContract } from 'viem'

import { getPublicClient, type ChainId } from '@/app/actions/clients'
import { fetchTokenDetails } from '@/app/actions/tokens'

export const getLinkDetails = unstable_cache(
    async (link: string): Promise<any> => {
        const params = peanut.getParamsFromLink(link)
        const chainId = params.chainId
        const contractVersion = params.contractVersion
        const depositIdx = params.depositIdx
        const client = await getPublicClient(Number(chainId) as ChainId)
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
        const { chainId, baseUrl, trackId } = linkDetails
        const client = await getPublicClient(Number(chainId) as ChainId)
        const txReceipt = await client.waitForTransactionReceipt({
            hash: txHash as `0x${string}`,
        })
        const contractVersion = peanut.detectContractVersionFromTxReceipt(txReceipt, chainId)
        const depositIdx = peanut.getDepositIdxs(txReceipt, chainId, contractVersion)[0]
        return peanut.getLinkFromParams(chainId, contractVersion, depositIdx, password, baseUrl, trackId)
    },
    ['getLinkFromTx']
)

import { getContractAbi, getContractAddress } from '@/utils/peanut-claim.utils'
import type { Address, Hash } from 'viem'

import { getPublicClient } from '@/app/actions/clients'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'

export async function getNextDepositIndex(contractVersion: string): Promise<number> {
    const publicClient = getPublicClient(PEANUT_WALLET_CHAIN.id)
    const contractAbi = getContractAbi(contractVersion)
    const contractAddress: Address = getContractAddress(PEANUT_WALLET_CHAIN.id.toString(), contractVersion) as Hash
    return (await publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'getDepositCount',
        args: [],
    })) as number
}

import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { type ChainValue, type IUserBalance } from '@/interfaces'
import * as Sentry from '@sentry/nextjs'
import { formatUnits } from 'viem'

export function calculateValuePerChain(balances: IUserBalance[]): ChainValue[] {
    let result: ChainValue[] = []

    try {
        const chainValueMap: { [key: string]: number } = {}
        balances.forEach((balance) => {
            const chainId = balance?.chainId ? balance.chainId.split(':')[1] : '1'
            if (!chainValueMap[chainId]) {
                chainValueMap[chainId] = 0
            }
            if (balance.value) chainValueMap[chainId] += Number(balance.value)
        })

        result = Object.keys(chainValueMap).map((chainId) => ({
            chainId,
            valuePerChain: chainValueMap[chainId],
        }))

        result.sort((a, b) => b.valuePerChain - a.valuePerChain)
    } catch (error) {
        Sentry.captureException(error)
        console.log('Error calculating value per chain: ', error)
    }
    return result
}

export const printableUsdc = (balance: bigint): string => {
    // For 6 decimals, we want 2 decimal places in output
    // So we divide by 10^4 to keep only 2 decimal places, then format
    const scaleFactor = BigInt(10 ** (PEANUT_WALLET_TOKEN_DECIMALS - 2)) // 10^4 = 10000n
    const flooredBigint = (balance / scaleFactor) * scaleFactor
    const formatted = formatUnits(flooredBigint, PEANUT_WALLET_TOKEN_DECIMALS)
    return Number(formatted).toFixed(2)
}

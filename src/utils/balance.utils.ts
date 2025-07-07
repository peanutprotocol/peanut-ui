import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { ChainValue, IUserBalance } from '@/interfaces'
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
    const formatted = formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS)
    // floor the formatted value
    const value = Number(formatted)
    const flooredValue = Math.floor(value * 100) / 100
    return flooredValue.toFixed(2)
}

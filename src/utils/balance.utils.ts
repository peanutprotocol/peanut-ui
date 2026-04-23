import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { formatUnits } from 'viem'

export const printableUsdc = (balance: bigint): string => {
    // For 6 decimals, we want 2 decimal places in output
    // So we divide by 10^4 to keep only 2 decimal places, then format
    const scaleFactor = BigInt(10 ** (PEANUT_WALLET_TOKEN_DECIMALS - 2)) // 10^4 = 10000n
    const flooredBigint = (balance / scaleFactor) * scaleFactor
    const formatted = formatUnits(flooredBigint, PEANUT_WALLET_TOKEN_DECIMALS)
    return Number(formatted).toFixed(2)
}

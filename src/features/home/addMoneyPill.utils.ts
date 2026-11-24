import { parseUnits } from 'viem'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/wallet-token.consts'

const usd = (amount: string) => parseUnits(amount, PEANUT_WALLET_TOKEN_DECIMALS)

/** spendable balance (USDC base units) bucketed for analytics.
 *  '<1' and '1-10' keep their names from the under-$10 gate (TASK-25076), so old data still compares */
export function balanceBucket(balance: bigint): '0' | '<1' | '1-10' | '10-100' | '100-1000' | '1000+' {
    if (balance <= 0n) return '0'
    if (balance < usd('1')) return '<1'
    if (balance < usd('10')) return '1-10'
    if (balance < usd('100')) return '10-100'
    if (balance < usd('1000')) return '100-1000'
    return '1000+'
}

import { parseUnits } from 'viem'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/wallet-token.consts'

// 93% of verified users' first money comes through Add, so a low balance
// turns Add into the labelled pill (TASK-25076). No cooldown, by decision.
const PILL_BELOW = parseUnits('10', PEANUT_WALLET_TOKEN_DECIMALS)
const ONE_DOLLAR = parseUnits('1', PEANUT_WALLET_TOKEN_DECIMALS)

export function showsAddMoneyPill(input: {
    isVerified: boolean
    /** spendable balance (wallet + card collateral), USDC base units */
    balance: bigint | undefined
    isFetching: boolean
    isStale: boolean | undefined
}): boolean {
    const { isVerified, balance, isFetching, isStale } = input
    return isVerified && !isFetching && !isStale && balance !== undefined && balance < PILL_BELOW
}

export function balanceBucket(balance: bigint): '0' | '<1' | '1-10' {
    if (balance <= 0n) return '0'
    return balance < ONE_DOLLAR ? '<1' : '1-10'
}

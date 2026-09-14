import { getMinWithdrawUsdForChain } from '@/utils/cross-chain-fee.utils'

/**
 * Whether a cross-chain claim is below its Rhino route minimum and must be
 * blocked. Rhino accepts a sub-minimum SDA deposit but never bridges it — the
 * funds strand at the deposit address with no auto-refund — so the claim has to
 * be stopped before it's signed. This applies to every cross-chain claim
 * destination (external wallet AND the claimer's own Peanut balance, which is a
 * fixed cross-chain hop to Arbitrum); only the copy differs by destination.
 *
 * Returns the route minimum when blocked, or null when the claim may proceed:
 * same-chain (not Rhino-routed), or no USD amount to size it against (unknown
 * token price) — in which case the server-side guard is the backstop.
 */
export function belowClaimBridgeMinimum(args: {
    isXChain: boolean
    destinationChainId: string
    amountUsd: number | null
}): { minUsd: number } | null {
    if (!args.isXChain) return null
    if (args.amountUsd == null || !Number.isFinite(args.amountUsd)) return null
    const minUsd = getMinWithdrawUsdForChain(args.destinationChainId)
    return args.amountUsd < minUsd ? { minUsd } : null
}

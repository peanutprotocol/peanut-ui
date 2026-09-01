import { isAddress } from 'viem'
import type { ClaimXChainPreview } from '@/components/Claim/Claim.consts'

/**
 * The address a cross-chain claim quote is priced for. Rhino's quote is
 * account- and address-bound, so it needs an EVM address on the destination
 * chain: the external wallet the claimer typed, else the Peanut wallet, else
 * the link sender (always an EVM address — a bank claim's `recipient.address`
 * is an IBAN or account number, which the quote would reject).
 */
export function resolveClaimQuoteRecipient(input: {
    recipientAddress: string
    walletAddress?: string
    senderAddress: string
}): string {
    if (isAddress(input.recipientAddress)) return input.recipientAddress
    return input.walletAddress ?? input.senderAddress
}

/**
 * A cached route is reusable only for the recipient it was quoted for —
 * switching the external address invalidates it even on the same chain/token
 * — and only until Rhino's quote expires: an expired entry is a miss, so the
 * caller re-quotes instead of showing a dead fee.
 */
export function findClaimRoute(
    routes: ClaimXChainPreview[],
    key: { chainId: string; tokenAddress: string; quotedFor: string },
    now: number = Date.now()
): ClaimXChainPreview | undefined {
    return routes.find(
        (route) =>
            route.chainId === key.chainId &&
            route.tokenAddress.toLowerCase() === key.tokenAddress.toLowerCase() &&
            route.quotedFor.toLowerCase() === key.quotedFor.toLowerCase() &&
            new Date(route.expiresAt).getTime() > now
    )
}

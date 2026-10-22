import { isAddress } from 'viem'
import { resolveEns } from '@/app/actions/ens'
import { getSupportedChainsAndTokens } from '@/app/actions/supported-chains'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import type { TokenMeta } from '@/interfaces/chain-meta'
import { parseAmountAndToken, parseRecipientAndChain } from '@/lib/url-parser/parser'
import { validateAmount } from '@/lib/validation/amount'
import { getChainDetails } from '@/lib/validation/token'
import { stashScannedDestination, withdrawScanEntryUrl, withdrawTokenForRequest } from './destination'

/**
 * Where a signed-in visit to a payment link for an EVM address or ENS name
 * (`/<recipient>[@<chain>][/<amount><token>]`) enters the crypto withdrawal,
 * through the same in-process hand-off a scan uses: the URL carries a scan id,
 * never the address.
 *
 * Returns null when the withdrawal cannot pay the link as written: an unknown
 * chain, a token the chain does not pay out, an amount or token with no chain to
 * check it against, an unresolved name, or any chain while the ops kill-switch
 * is on. The caller then keeps the payment page, which serves the link as it
 * always has. A page visit has no "not supported" modal to show, and the payment
 * page is a working fallback.
 */
export async function withdrawEntryForLink(segments: string[]): Promise<string | null> {
    if (segments.length === 0 || segments.length > 2) return null
    const { recipient, chainId: chainName } = parseRecipientAndChain(segments[0])

    let amountAndToken: ReturnType<typeof parseAmountAndToken>
    try {
        amountAndToken = parseAmountAndToken(segments[1] ?? '')
        if (amountAndToken.amount) validateAmount(amountAndToken.amount)
    } catch {
        return null
    }
    const { amount, token: tokenSymbol } = amountAndToken
    const asksForAsset = !!amount || !!tokenSymbol

    let chainId: string | undefined
    let requested: TokenMeta | undefined
    if (chainName) {
        let chainTokens: TokenMeta[]
        try {
            const chain = getChainDetails(chainName, await getSupportedChainsAndTokens())
            chainId = chain.chainId
            chainTokens = chain.tokens
        } catch {
            return null
        }
        if (asksForAsset) {
            // An amount with no token is in USDC, as the payment page reads it.
            // The request is paid in its token or not at all.
            requested = withdrawTokenForRequest(chainTokens, { tokenSymbol: tokenSymbol ?? 'USDC' })
            if (!requested) return null
        }
    } else if (asksForAsset) {
        // A token cannot be checked against a chain nobody named.
        return null
    }

    // A name can hold a different address per chain (ENSIP-11). With no chain
    // named, the withdrawal starts on the wallet chain, as for a scanned name.
    const isName = !isAddress(recipient)
    const address = isName ? await resolveEns(recipient, chainId ?? PEANUT_WALLET_CHAIN.id.toString()) : recipient
    if (!address) return null

    const scanId = stashScannedDestination(address, chainId, {
        name: isName ? recipient : undefined,
        tokenSymbol: requested?.symbol,
        tokenAddress: requested?.address,
    })
    if (!scanId) return null
    return withdrawScanEntryUrl(scanId, { tokenSymbol: requested?.symbol, amount })
}

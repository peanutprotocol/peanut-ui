/** Pre-decomplexify this hit a third-party API for chain + token metadata.
 *  Post-decomplexify (Rhino SDA cutover) the data is local — same shape,
 *  same callsites, no live API call. The legacy `Squid` naming —
 *  see decomplexify TODO #46 for the rename. */

import * as interfaces from '@/interfaces/peanut-sdk-types'
import { supportedPeanutChains, peanutTokenDetails } from '@/constants/general.consts'

type ChainWithTokens = interfaces.IChainMeta & { networkName: string; tokens: interfaces.ITokenMeta[] }

export async function getSupportedChainsAndTokens(): Promise<Record<string, ChainWithTokens>> {
    const result: Record<string, ChainWithTokens> = {}
    for (const chain of supportedPeanutChains) {
        if (!chain.mainnet) continue
        result[chain.chainId] = {
            chainId: chain.chainId,
            axelarChainName: chain.shortName ?? chain.name,
            chainType: 'evm',
            chainIconURI: chain.icon?.url ?? '',
            networkName: chain.name,
            tokens: [],
        }
    }
    for (const chainTokens of peanutTokenDetails) {
        const bucket = result[chainTokens.chainId]
        if (!bucket) continue
        for (const token of chainTokens.tokens) {
            bucket.tokens.push({
                active: true,
                chainId: chainTokens.chainId,
                address: token.address,
                decimals: token.decimals,
                name: token.name,
                symbol: token.symbol,
                logoURI: token.logoURI,
                usdPrice: 0,
            })
        }
    }
    return result
}

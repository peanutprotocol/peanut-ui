import { CHAIN_REGISTRY } from '@/constants/chainRegistry.consts'
import { nativeCurrencyAddresses } from '@/constants/general.consts'
import { RECOVER_FUNDS_EXTRA_TOKENS } from '@/constants/recover-funds.consts'
import { peanutTokenDetails } from '@/constants/token-registry.consts'
import { PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import type { RecoverableToken, RhinoTokenConfigs } from '@/types/recover-funds'
import { getTokenLogo } from '@/utils/general.utils'

const isNativeAddress = (address: string) => nativeCurrencyAddresses.includes(address.toLowerCase())

/**
 * The ERC-20 tokens recover funds reads on a chain: the union by address of our
 * token list, Rhino's list for that chain and RECOVER_FUNDS_EXTRA_TOKENS
 * (TASK-23850). Without Rhino's list (it failed to load) the other two still
 * count. The native coin is read on its own, and the Peanut wallet's USDC is
 * the wallet balance, not something to recover.
 */
export function recoverableTokensForChain(chainId: string, rhinoTokens: RhinoTokenConfigs | null): RecoverableToken[] {
    const rhinoName = CHAIN_REGISTRY.find((entry) => entry.id === chainId)?.rhinoName
    const candidates: RecoverableToken[] = [
        ...(peanutTokenDetails.find((entry) => entry.chainId === chainId)?.tokens ?? []),
        ...((rhinoName && rhinoTokens?.[rhinoName]) || []).map((token) => ({
            address: token.tokenAddress,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoURI: getTokenLogo(token.symbol) || token.iconUrl || '',
        })),
        ...(RECOVER_FUNDS_EXTRA_TOKENS[chainId] ?? []),
    ]
    const byAddress = new Map<string, RecoverableToken>()
    for (const token of candidates) {
        const key = token.address.toLowerCase()
        if (byAddress.has(key) || isNativeAddress(key) || key === PEANUT_WALLET_TOKEN.toLowerCase()) continue
        byAddress.set(key, token)
    }
    return [...byAddress.values()]
}

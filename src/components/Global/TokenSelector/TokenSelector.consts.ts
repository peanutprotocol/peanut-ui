import { SOLANA_ICON, TRON_ICON } from '@/assets'
import { networks } from '@/config'
import * as interfaces from '@/interfaces'

interface CombinedType extends interfaces.IPeanutChainDetails {
    tokens: interfaces.IToken[]
}

export interface TokenSelectorProps {
    classNameButton?: string
    shouldBeConnected?: boolean
    showOnlySquidSupported?: boolean
    onReset?: () => void
}

export interface TokenSelectorXChainProps extends TokenSelectorProps {
    data?: CombinedType[]
    tokenSymbol?: string
    tokenAddress?: string
    chainName?: string
    tokenLogoUrl?: string
    chainLogoUrl?: string
    tokenAmount?: string
    isLoading?: boolean
    routeError?: boolean
    routeFound?: boolean
    onReset?: () => void
    isStatic?: boolean
}

// network configuration for the token selector
export interface NetworkConfig {
    chainId: string
    name: string
    iconUrl: string
}

export const TOKEN_SELECTOR_COMING_SOON_NETWORKS: NetworkConfig[] = [
    {
        chainId: 'solana',
        name: 'Solana',
        iconUrl: SOLANA_ICON,
    },
    {
        chainId: 'tron',
        name: 'Tron',
        iconUrl: TRON_ICON,
    },
]

// popular networks mapping for the token selector - using the chainId as the key to get chain details from squid within token selector component
export const TOKEN_SELECTOR_POPULAR_NETWORK_IDS = [
    {
        chainId: '42161',
        name: 'ARB',
    },
    {
        chainId: '1',
        name: 'ETH',
    },
    {
        chainId: '10',
        name: 'OP',
    },
    {
        chainId: '8453',
        name: 'BASE',
    },
]

// supported network ids for the network list, getting this from reown appkit config
export const TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS = networks.map((network) => network.id.toString())

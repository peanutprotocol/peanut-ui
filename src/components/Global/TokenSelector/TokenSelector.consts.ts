import * as interfaces from '@/interfaces'

export interface CombinedType extends interfaces.IPeanutChainDetails {
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

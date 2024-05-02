export interface IUserBalance {
    chainId: string
    address: string
    name: string
    symbol: string
    decimals: number
    price: number
    amount: number
    currency: string
    logoURI: string
}

export interface IPeanutChainDetails {
    name: string
    chain: string
    icon: {
        url: string

        format: string
    }
    rpc: string[]
    features: {
        name: string
    }[]
    faucets: string[]
    nativeCurrency: {
        name: string
        symbol: string
        decimals: number
    }
    infoURL: string
    shortName: string
    chainId: string
    networkId: number
    slip44: number
    ens: {
        registry: string
    }
    explorers: {
        name: string
        url: string
        standard: string
    }[]
    mainnet: boolean
}

export interface IPeanutTokenDetail {
    chainId: string
    name: string
    tokens: IToken[]
}

export interface IToken {
    address: string
    name: string
    symbol: string
    decimals: number
    logoURI: string
}

export interface ILocalStorageItem {
    address: string
    hash: string
    idx?: string
    link: string
}

export interface ILinkDetails {
    link: string
    chainId: string
    depositIndex: number
    contractVersion: string
    password: string
    senderAddress: any
    tokenType: any
    tokenAddress: any
    tokenDecimals: any
    tokenSymbol: any
    tokenName: any
    tokenAmount: string
    tokenId: number
    claimed: boolean
    depositDate: Date
    tokenURI: any
    metadata: any
    rawOnchainDepositInfo: {}
}

export interface IChain {
    chainId: string
    axelarChainName: string
    chainType: string
}

export interface IToken {
    chainId: string
    address: string
    name: string
    symbol: string
}

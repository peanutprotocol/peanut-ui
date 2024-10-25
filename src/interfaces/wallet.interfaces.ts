
export enum WalletProviderType {
    PEANUT = 'PEANUT',
    BYOW = 'BYOW'
}

export enum WalletChainType {
    EVM = 'EVM'
}

export interface IWallet {
    walletProviderType: WalletProviderType | undefined
    // connected refers to the provider state
    //
    // The user may select a wallet but the provider may be connected
    // with another wallet. That would mean that: connected == False, in
    // this case. It will always be true if the active wallet is Peanut Wallet
    // and the user is logged in. That is because there is only one PW per user,
    // and the provider will always be connected to that.
    connected: boolean
    address: string | undefined
}


import * as interfaces from '@/interfaces'

// based on API AccountType
// https://github.com/peanutprotocol/peanut-api-ts/blob/b32570b7bd366efed7879f607040c511fa036a57/src/db/interfaces/account.ts
export enum WalletProviderType {
    PEANUT = interfaces.AccountType.PEANUT_WALLET,
    BYOW = interfaces.AccountType.EVM_ADDRESS,
}

export enum WalletProtocolType {
    EVM = 'EVM',
}

// the data model as it is fetched from the backend
export interface IDBWallet {
    walletProviderType: WalletProviderType
    protocolType: WalletProtocolType
    address: string
    connector?: {
        iconUrl: string
        name: string
    }
}

export interface IWallet extends IDBWallet {
    // connected refers to the provider state
    //
    // The user may select a wallet but the provider may be connected
    // with another wallet. That would mean that: connected == False, in
    // this case. It will always be true if the active wallet is Peanut Wallet
    // and the user is logged in. That is because there is only one PW per user,
    // and the provider will always be connected to that.
    connected: boolean
    balance: bigint
    balances?: interfaces.IUserBalance[]
}

export enum WalletErrorType {
    WALLET_FETCH_ERROR_USER_NOT_AUTHED = 'Wallet Error! Can not fetch wallets when user not logged in!',
    WALLET_FETCH_ERROR = 'Wallet Error! Can not fetch wallets',

    PROVIDER_TYPE_ERROR = 'Wallet Error! Wallet is not of known provider type!',

    PW_KERNEL_NOT_READY = 'Peanut Wallet Error! Kernel not ready',

    BYOB_NOT_CONNECTED = 'Wallet Error! No external wallet connected in the provider!',
    BYOB_CONNECTED_TO_WRONG_WALLET = 'Wallet Error! Your external wallet is connected to the wrong wallet!',
}

export interface IWalletError {
    walletErrorType: WalletErrorType
}

export class WalletError extends Error implements IWalletError {
    walletErrorType: WalletErrorType

    constructor(walletErrorType: WalletErrorType, message: string | undefined = undefined) {
        if (!message) {
            message = walletErrorType.valueOf()
        }
        super(message)
        this.walletErrorType = walletErrorType
        this.name = 'WalletError'

        // fixes the prototype chain for inheritance when targeting ES5 or earlier
        Object.setPrototypeOf(this, WalletError.prototype)
    }
}

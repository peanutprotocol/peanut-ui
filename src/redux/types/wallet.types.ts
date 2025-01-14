import { IDBWallet, IUserBalance } from '@/interfaces'

export interface IWalletState {
    selectedWallet?: IWalletInStore
    wallets: IWalletInStore[]
    signInModalVisible: boolean
}

export interface IWalletInStore extends Omit<IDBWallet, 'balance'> {
    balance: string
    balances?: IUserBalance[]
    connected: boolean
}

export interface IWallet extends Omit<IDBWallet, 'balance'> {
    balance: bigint
    balances?: IUserBalance[]
    connected: boolean
}

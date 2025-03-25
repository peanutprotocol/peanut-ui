import { IUserBalance, IWallet } from '@/interfaces'

interface WalletBalances {
    [address: string]: {
        balances: IUserBalance[]
        totalBalance: number
        lastFetched: number
    }
}

export interface WalletUIState {
    selectedWalletId: string | undefined
    focusedWallet: string | undefined
    signInModalVisible: boolean
    wallets: IWallet[]
    isConnected: boolean
    walletColor: string
    isFetchingWallets: boolean
    rewardWalletBalance: string
    walletBalances: WalletBalances | undefined
}

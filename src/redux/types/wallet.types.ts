import { IWallet } from '@/interfaces'

export interface WalletUIState {
    selectedAddress?: string | undefined
    focusedWallet?: string | undefined
    signInModalVisible: boolean
    wallets: IWallet[]
    isConnected: boolean
    walletColor: string
    isFetchingWallets: boolean
}

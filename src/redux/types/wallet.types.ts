import { IWallet } from '@/interfaces'

export interface WalletUIState {
    selectedWalletId?: string | undefined
    focusedWallet?: string | undefined
    signInModalVisible: boolean
    wallets: IWallet[]
    isConnected: boolean
    walletColor: string
    isFetchingWallets: boolean
}

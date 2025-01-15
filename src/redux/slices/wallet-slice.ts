import { getUserPreferences, updateUserPreferences } from '@/utils'
import { createSlice } from '@reduxjs/toolkit'
import { WALLET_SLICE } from '../constants'
import { WalletUIState } from '../types/wallet.types'

const initialState: WalletUIState = {
    selectedAddress: getUserPreferences()?.lastSelectedWallet?.address,
    signInModalVisible: false,
    wallets: [],
    isConnected: false,
    walletColor: 'rgba(0,0,0,0)',
}

const walletSlice = createSlice({
    name: WALLET_SLICE,
    initialState,
    reducers: {
        setSelectedAddress: (state, action) => {
            state.selectedAddress = action.payload
            updateUserPreferences({
                lastSelectedWallet: { address: action.payload },
            })
        },
        setSignInModalVisible: (state, action) => {
            state.signInModalVisible = action.payload
        },
        setWallets: (state, action) => {
            state.wallets = action.payload
        },
        setIsConnected: (state, action) => {
            state.isConnected = action.payload
        },
        setWalletColor: (state, action) => {
            state.walletColor = action.payload
        },
        updateWalletBalance: (state, action) => {
            const { address, balance, balances } = action.payload
            const walletIndex = state.wallets.findIndex((w) => w.address === address)
            if (walletIndex !== -1) {
                state.wallets[walletIndex] = {
                    ...state.wallets[walletIndex],
                    balance,
                    balances,
                }
            }
        },
    },
})
export const walletActions = walletSlice.actions
export default walletSlice.reducer

import { getUserPreferences, updateUserPreferences } from '@/utils'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { WALLET_SLICE } from '../constants'
import { WalletUIState } from '../types/wallet.types'

const initialState: WalletUIState = {
    selectedAddress: getUserPreferences()?.lastSelectedWallet?.address,
    focusedWallet: getUserPreferences()?.lastFocusedWallet?.address,
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
        setFocusedWallet: (state, action) => {
            state.focusedWallet = action.payload.address
            updateUserPreferences({
                lastFocusedWallet: { address: action.payload.address },
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
        removeWallet: (state, action: PayloadAction<string>) => {
            // remove wallet from the wallets array
            state.wallets = state.wallets.filter(
                (wallet) => wallet.address.toLowerCase() !== action.payload.toLowerCase()
            )

            // if removed wallet was selected, clear the selection
            if (state.selectedAddress?.toLowerCase() === action.payload.toLowerCase()) {
                state.selectedAddress = undefined
                // update user preferences to remove the last selected wallet
                updateUserPreferences({
                    lastSelectedWallet: undefined,
                })
            }

            // if the removed wallet was focused, clear the focus
            if (state.focusedWallet?.toLowerCase() === action.payload.toLowerCase()) {
                state.focusedWallet = undefined
                // update user preferences to remove the last focused wallet
                updateUserPreferences({
                    lastFocusedWallet: undefined,
                })
            }
        },
    },
})

export const walletActions = walletSlice.actions
export default walletSlice.reducer

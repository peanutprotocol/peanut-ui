import { getUserPreferences, updateUserPreferences } from '@/utils'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { WALLET_SLICE } from '../constants'
import { WalletUIState } from '../types/wallet.types'

const initialState: WalletUIState = {
    selectedWalletId: getUserPreferences()?.lastSelectedWallet?.id,
    focusedWallet: getUserPreferences()?.lastFocusedWallet?.id,
    signInModalVisible: false,
    wallets: [],
    isConnected: false,
    walletColor: 'rgba(0,0,0,0)',
    isFetchingWallets: false,
}

const walletSlice = createSlice({
    name: WALLET_SLICE,
    initialState,
    reducers: {
        setSelectedWalletId: (state, action) => {
            state.selectedWalletId = action.payload
            updateUserPreferences({
                lastSelectedWallet: { id: action.payload },
            })
        },
        setFocusedWallet: (state, action) => {
            state.focusedWallet = action.payload.id
            updateUserPreferences({
                lastFocusedWallet: { id: action.payload.id },
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
            if (state.selectedWalletId?.toLowerCase() === action.payload.toLowerCase()) {
                state.selectedWalletId = undefined
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
        setIsFetchingWallets: (state, action) => {
            state.isFetchingWallets = action.payload
        },
    },
})

export const walletActions = walletSlice.actions
export default walletSlice.reducer

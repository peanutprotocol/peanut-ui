import { createSlice } from '@reduxjs/toolkit'
import { WALLET_SLICE } from '../constants'
import { WalletUIState } from '../types/wallet.types'

const initialState: WalletUIState = {
    signInModalVisible: false,
    rewardWalletBalance: '',
    balance: 0n,
}

const walletSlice = createSlice({
    name: WALLET_SLICE,
    initialState,
    reducers: {
        setSignInModalVisible: (state, action) => {
            state.signInModalVisible = action.payload
        },
        setBalance: (state, action) => {
            state.balance = action.payload
        },
        setRewardWalletBalance: (state, action) => {
            state.rewardWalletBalance = action.payload
        },
    },
})

export const walletActions = walletSlice.actions
export default walletSlice.reducer

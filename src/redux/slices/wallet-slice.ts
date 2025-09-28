import { createSlice } from '@reduxjs/toolkit'
import { WALLET_SLICE } from '../constants'
import { WalletUIState } from '../types/wallet.types'
import { PayloadAction } from '@reduxjs/toolkit'

const initialState: WalletUIState = {
    signInModalVisible: false,
    balance: undefined,
}

const walletSlice = createSlice({
    name: WALLET_SLICE,
    initialState,
    reducers: {
        setSignInModalVisible: (state, action) => {
            state.signInModalVisible = action.payload
        },
        setBalance: (state, action: PayloadAction<bigint>) => {
            state.balance = action.payload.toString()
        },
    },
})

export const walletActions = walletSlice.actions
export default walletSlice.reducer

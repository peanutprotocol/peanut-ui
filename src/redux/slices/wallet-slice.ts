import { createSlice } from '@reduxjs/toolkit'
import { WALLET_SLICE } from '../constants'
import { type WalletUIState } from '../types/wallet.types'
import { type PayloadAction } from '@reduxjs/toolkit'

const initialState: WalletUIState = {
    balance: undefined,
}

const walletSlice = createSlice({
    name: WALLET_SLICE,
    initialState,
    reducers: {
        setBalance: (state, action: PayloadAction<bigint>) => {
            state.balance = action.payload.toString()
        },
    },
})

export const walletActions = walletSlice.actions
export default walletSlice.reducer

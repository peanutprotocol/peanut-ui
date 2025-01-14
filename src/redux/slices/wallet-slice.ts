import { getUserPreferences, updateUserPreferences } from '@/utils'
import { createSlice } from '@reduxjs/toolkit'
import { WalletUIState } from '../types/wallet.types'

const initialState: WalletUIState = {
    selectedAddress: getUserPreferences()?.lastSelectedWallet?.address,
    signInModalVisible: false,
}

const walletSlice = createSlice({
    name: 'walletUI',
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
    },
})

export const walletActions = walletSlice.actions
export default walletSlice.reducer

import { IUserBalance } from '@/interfaces'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { IWallet, IWalletState } from '../types/wallet.types'

const initialState: IWalletState = {
    selectedWallet: undefined,
    wallets: [],
    signInModalVisible: false,
}

const walletSlice = createSlice({
    name: 'wallet',
    initialState,
    reducers: {
        setSelectedWallet: (state, action: PayloadAction<Omit<IWallet, 'balance'> & { balance: string }>) => {
            state.selectedWallet = {
                ...action.payload,
                balance: action.payload.balance,
            }
        },
        setWallets: (state, action: PayloadAction<(Omit<IWallet, 'balance'> & { balance: string })[]>) => {
            state.wallets = action.payload
        },
        updateWalletBalance: (
            state,
            action: PayloadAction<{
                address: string
                balance: bigint
                balances?: IUserBalance[]
            }>
        ) => {
            const walletIndex = state.wallets.findIndex((w) => w.address === action.payload.address)
            if (walletIndex !== -1) {
                state.wallets[walletIndex] = {
                    ...state.wallets[walletIndex],
                    balance: action.payload.balance.toString(), // convert BigInt to string
                    balances: action.payload.balances || state.wallets[walletIndex].balances,
                }
            }
        },
        setSignInModalVisible: (state, action: PayloadAction<boolean>) => {
            state.signInModalVisible = action.payload
        },
    },
})

export const walletActions = walletSlice.actions
export default walletSlice.reducer

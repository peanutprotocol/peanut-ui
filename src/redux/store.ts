import { configureStore } from '@reduxjs/toolkit'
import setupReducer from './slices/setup-slice'
import walletReducer from './slices/wallet-slice'

const store = configureStore({
    reducer: {
        setup: setupReducer,
        wallet: walletReducer,
    },
})

export default store

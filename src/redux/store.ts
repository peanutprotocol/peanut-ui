import { configureStore } from '@reduxjs/toolkit'
import setupReducer from './slices/setup-slice'
import walletReducer from './slices/wallet-slice'
import zeroDevReducer from './slices/zerodev-slice'

const store = configureStore({
    reducer: {
        setup: setupReducer,
        wallet: walletReducer,
        zeroDev: zeroDevReducer,
    },
    // disable redux serialization checks
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
})

export default store

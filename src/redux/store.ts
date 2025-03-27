import { configureStore } from '@reduxjs/toolkit'
import paymentReducer from './slices/payment-slice'
import setupReducer from './slices/setup-slice'
import userReducer from './slices/user-slice'
import walletReducer from './slices/wallet-slice'
import zeroDevReducer from './slices/zerodev-slice'

const store = configureStore({
    reducer: {
        setup: setupReducer,
        wallet: walletReducer,
        zeroDev: zeroDevReducer,
        payment: paymentReducer,
        user: userReducer,
    },
    // disable redux serialization checks
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
})

export default store

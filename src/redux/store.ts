import { configureStore } from '@reduxjs/toolkit'
import paymentReducer from './slices/payment-slice'
import sendFlowReducer from './slices/send-flow-slice'
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
        sendFlow: sendFlowReducer,
    },
    // disable redux serialization checks
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
})

export default store

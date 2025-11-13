import { configureStore } from '@reduxjs/toolkit'
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist'
import storage from 'redux-persist/lib/storage' // defaults to localStorage for web
import paymentReducer from './slices/payment-slice'
import sendFlowReducer from './slices/send-flow-slice'
import setupReducer from './slices/setup-slice'
import userReducer from './slices/user-slice'
import walletReducer from './slices/wallet-slice'
import zeroDevReducer from './slices/zerodev-slice'
import bankFormReducer from './slices/bank-form-slice'

// OFFLINE SUPPORT: Persist user data to survive page reloads
// for PWA offline functionality - allows app to render without API call

/**
 * localStorage key for persisted Redux user state
 * Must be manually cleared on logout to prevent user data leakage
 * Format: 'persist:' prefix is added by redux-persist automatically
 */
export const PERSIST_USER_KEY = 'persist:user'

const userPersistConfig = {
    key: 'user', // This becomes 'persist:user' in localStorage
    storage,
    // Only persist the user profile data, not loading states
    whitelist: ['user'],
}

const persistedUserReducer = persistReducer(userPersistConfig, userReducer)

const store = configureStore({
    reducer: {
        setup: setupReducer,
        wallet: walletReducer,
        zeroDev: zeroDevReducer,
        payment: paymentReducer,
        user: persistedUserReducer, // Use persisted reducer for user slice
        sendFlow: sendFlowReducer,
        bankForm: bankFormReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // Ignore redux-persist actions
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
            },
        }),
})

export const persistor = persistStore(store)
export default store

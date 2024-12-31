import { configureStore } from '@reduxjs/toolkit'
import setupReducer from './slices/setup-slice'

const store = configureStore({
    reducer: {
        setup: setupReducer,
    },
})

export default store

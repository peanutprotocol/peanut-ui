import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { PAYMENT_SLICE } from '../constants'
import { IPaymentState } from '../types/payment.types'

const initialState: IPaymentState = {
    currentView: 1,
}

const paymentSlice = createSlice({
    name: PAYMENT_SLICE,
    initialState,
    reducers: {
        setView: (state, action: PayloadAction<number>) => {
            state.currentView = action.payload
        },
    },
})

export const paymentActions = paymentSlice.actions
export default paymentSlice.reducer

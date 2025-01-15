import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ZERODEV_SLICE } from '../constants'
import { ZeroDevState } from '../types/zerodev.types'

const initialState: ZeroDevState = {
    isKernelClientReady: false,
    isRegistering: false,
    isLoggingIn: false,
    isSendingUserOp: false,
    address: undefined,
}

const zeroDevSlice = createSlice({
    name: ZERODEV_SLICE,
    initialState,
    reducers: {
        setIsKernelClientReady(state, action: PayloadAction<boolean>) {
            state.isKernelClientReady = action.payload
        },
        setIsRegistering(state, action: PayloadAction<boolean>) {
            state.isRegistering = action.payload
        },
        setIsLoggingIn(state, action: PayloadAction<boolean>) {
            state.isLoggingIn = action.payload
        },
        setIsSendingUserOp(state, action: PayloadAction<boolean>) {
            state.isSendingUserOp = action.payload
        },
        setAddress(state, action: PayloadAction<string | undefined>) {
            state.address = action.payload
        },
        resetZeroDevState(state) {
            Object.assign(state, initialState)
        },
    },
})

export const zerodevActions = zeroDevSlice.actions
export default zeroDevSlice.reducer

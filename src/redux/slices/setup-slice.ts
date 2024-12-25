import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { SETUP } from '../constants'
import { ISetupState } from '../types/setup'

const initialState: ISetupState = {
    step: 0,
}

const setupSlice = createSlice({
    name: SETUP,
    initialState,
    reducers: {
        setStep: (state, action: PayloadAction<number>) => {
            state.step = action.payload
        },
    },
})

export const setupActions = setupSlice.actions
export default setupSlice.reducer

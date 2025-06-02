import { ISetupStep } from '@/components/Setup/Setup.types'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { SETUP } from '../constants'
import { ISetupState } from '../types/setup.types'

const initialState: ISetupState = {
    username: '',
    currentStep: 1,
    direction: 0,
    isLoading: false,
    steps: [],
}

const setupSlice = createSlice({
    name: SETUP,
    initialState,
    reducers: {
        setUsername: (state, action: PayloadAction<string>) => {
            state.username = action.payload
        },
        resetSetup: (state) => {
            state.username = ''
            state.currentStep = 1
            state.direction = 0
            state.isLoading = false
            state.steps = []
        },
        nextStep: (state) => {
            state.direction = 1
            state.currentStep = Math.min(state.steps.length, state.currentStep + 1)
        },
        previousStep: (state) => {
            state.direction = -1
            state.currentStep = Math.max(1, state.currentStep - 1)
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload
        },

        setSteps: (state, action: PayloadAction<ISetupStep[]>) => {
            state.steps = action.payload
        },

        setStep: (state, action: PayloadAction<number>) => {
            state.currentStep = action.payload
        },
    },
})

export const setupActions = setupSlice.actions
export default setupSlice.reducer

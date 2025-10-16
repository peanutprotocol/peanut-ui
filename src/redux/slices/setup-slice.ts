import { type ISetupStep } from '@/components/Setup/Setup.types'
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { SETUP } from '../constants'
import { type ISetupState } from '../types/setup.types'
import { EInviteType } from '@/services/services.types'

const initialState: ISetupState = {
    username: '',
    currentStep: 1,
    direction: 0,
    isLoading: false,
    telegramHandle: '',
    steps: [],
    inviteCode: '',
    inviteType: EInviteType.DIRECT,
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
            state.telegramHandle = ''
            state.currentStep = 1
            state.direction = 0
            state.isLoading = false
            state.steps = []
            state.inviteCode = ''
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
        setTelegramHandle: (state, action: PayloadAction<string>) => {
            state.telegramHandle = action.payload
        },
        setInviteCode: (state, action: PayloadAction<string>) => {
            state.inviteCode = action.payload
        },
        setInviteType: (state, action: PayloadAction<EInviteType>) => {
            state.inviteType = action.payload
        },
    },
})

export const setupActions = setupSlice.actions
export default setupSlice.reducer

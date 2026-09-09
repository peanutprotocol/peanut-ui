import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { BANK_FORM_SLICE } from '../constants'
import { type IBankFormState } from '../types/bank-form.types'
import { type IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'

const initialState: IBankFormState = {
    formData: null,
}

const bankFormSlice = createSlice({
    name: BANK_FORM_SLICE,
    initialState,
    reducers: {
        setFormData(state, action: PayloadAction<Partial<IBankAccountDetails>>) {
            state.formData = { ...(state.formData ?? {}), ...action.payload }
        },
        updateFormField(
            state,
            action: PayloadAction<{
                field: keyof IBankAccountDetails
                value: string
            }>
        ) {
            const { field, value } = action.payload
            if (!state.formData) {
                state.formData = {}
            }
            state.formData[field] = value
        },
        clearFormData(state) {
            state.formData = null
        },
    },
})

export const bankFormActions = bankFormSlice.actions
export default bankFormSlice.reducer

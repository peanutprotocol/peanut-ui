import { IAttachmentOptions } from '@/components/Create/Create.consts'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { PaymentCreationResponse } from '@/services/services.types'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { PAYMENT_SLICE } from '../constants'
import { IPaymentState } from '../types/payment.types'

const initialState: IPaymentState = {
    currentView: 1,
    attachmentOptions: {
        fileUrl: '',
        message: '',
        rawFile: undefined,
    },
    urlParams: null,
    requestDetails: null,
    transactionHash: null,
    paymentDetails: null,
    existingRequestId: null,
}

const paymentSlice = createSlice({
    name: PAYMENT_SLICE,
    initialState,
    reducers: {
        setView: (state, action: PayloadAction<number>) => {
            state.currentView = action.payload
        },
        setAttachmentOptions: (state, action: PayloadAction<IAttachmentOptions>) => {
            state.attachmentOptions = action.payload
        },
        setUrlParams: (state, action: PayloadAction<ParsedURL>) => {
            state.urlParams = action.payload
        },
        setRequestDetails: (state, action) => {
            state.requestDetails = action.payload
        },
        setTransactionHash: (state, action) => {
            state.transactionHash = action.payload
        },
        setPaymentDetails: (state, action: PayloadAction<PaymentCreationResponse>) => {
            state.paymentDetails = action.payload
        },
        setExistingRequestId: (state, action: PayloadAction<string>) => {
            state.existingRequestId = action.payload
        },
    },
})

export const paymentActions = paymentSlice.actions
export default paymentSlice.reducer

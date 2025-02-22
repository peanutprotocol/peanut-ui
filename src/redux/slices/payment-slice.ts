import { IAttachmentOptions } from '@/components/Create/Create.consts'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { PaymentCreationResponse, TCharge, TRequestChargeResponse, TRequestResponse } from '@/services/services.types'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { PAYMENT_SLICE } from '../constants'
import { IPaymentState, TPaymentView } from '../types/payment.types'

const initialState: IPaymentState = {
    currentView: 'INITIAL',
    attachmentOptions: {
        fileUrl: '',
        message: '',
        rawFile: undefined,
    },
    parsedPaymentData: null,
    requestDetails: null,
    chargeDetails: null,
    createdChargeDetails: null,
    transactionHash: null,
    paymentDetails: null,
    resolvedAddress: null,
    error: null,
}

const paymentSlice = createSlice({
    name: PAYMENT_SLICE,
    initialState,
    reducers: {
        setView: (state, action: PayloadAction<TPaymentView>) => {
            state.currentView = action.payload
        },
        setAttachmentOptions: (state, action: PayloadAction<IAttachmentOptions>) => {
            state.attachmentOptions = action.payload
        },
        setParsedPaymentData: (state, action: PayloadAction<ParsedURL>) => {
            state.parsedPaymentData = action.payload
        },
        setRequestDetails: (state, action: PayloadAction<TRequestResponse | null>) => {
            state.requestDetails = action.payload
        },
        setChargeDetails: (state, action: PayloadAction<TRequestChargeResponse | null>) => {
            state.chargeDetails = action.payload
        },
        setCreatedChargeDetails: (state, action: PayloadAction<TCharge | null>) => {
            state.createdChargeDetails = action.payload
        },
        setTransactionHash: (state, action: PayloadAction<string | null>) => {
            state.transactionHash = action.payload
        },
        setPaymentDetails: (state, action: PayloadAction<PaymentCreationResponse>) => {
            state.paymentDetails = action.payload
        },
        setResolvedAddress: (state, action: PayloadAction<string | null>) => {
            state.resolvedAddress = action.payload
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload
        },
    },
})

export const paymentActions = paymentSlice.actions
export default paymentSlice.reducer

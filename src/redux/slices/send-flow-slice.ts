import { createSlice } from '@reduxjs/toolkit'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { SEND_FLOW_SLICE } from '../constants'
import { IAttachmentOptions, ISendFlowState, Recipient, SendFlowTxnType, SendFlowView } from '../types/send-flow.types'

const initialState: ISendFlowState = {
    view: 'INITIAL',
    tokenValue: undefined,
    recipient: {
        address: undefined,
        name: undefined,
    },
    usdValue: undefined,
    linkDetails: undefined,
    password: undefined,
    transactionType: 'not-gasless',
    gaslessPayload: undefined,
    gaslessPayloadMessage: undefined,
    preparedDepositTxs: undefined,
    txHash: undefined,
    link: undefined,
    feeOptions: undefined,
    transactionCostUSD: undefined,
    attachmentOptions: {
        fileUrl: undefined,
        message: undefined,
        rawFile: undefined,
    },
    errorState: undefined,
    crossChainDetails: undefined,
}

const sendFlowSlice = createSlice({
    name: SEND_FLOW_SLICE,
    initialState,
    reducers: {
        setView(state, action: { payload: SendFlowView }) {
            state.view = action.payload
        },
        setTokenValue(state, action: { payload: string | undefined }) {
            state.tokenValue = action.payload
        },
        setRecipient(state, action: { payload: Recipient }) {
            state.recipient = action.payload
        },
        setUsdValue(state, action: { payload: string | undefined }) {
            state.usdValue = action.payload
        },
        setLinkDetails(state, action: { payload: peanutInterfaces.IPeanutLinkDetails | undefined }) {
            state.linkDetails = action.payload
        },
        setPassword(state, action: { payload: string | undefined }) {
            state.password = action.payload
        },
        setTransactionType(state, action: { payload: SendFlowTxnType }) {
            state.transactionType = action.payload
        },
        setGaslessPayload(state, action: { payload: peanutInterfaces.IGaslessDepositPayload | undefined }) {
            state.gaslessPayload = action.payload
        },
        setGaslessPayloadMessage(state, action: { payload: peanutInterfaces.IPreparedEIP712Message | undefined }) {
            state.gaslessPayloadMessage = action.payload
        },
        setPreparedDepositTxs(state, action: { payload: peanutInterfaces.IPrepareDepositTxsResponse | undefined }) {
            state.preparedDepositTxs = action.payload
        },
        setTxHash(state, action: { payload: string | undefined }) {
            state.txHash = action.payload
        },
        setLink(state, action: { payload: string | undefined }) {
            state.link = action.payload
        },
        setFeeOptions(state, action: { payload: any | undefined }) {
            state.feeOptions = action.payload
        },
        setTransactionCostUSD(state, action: { payload: number | undefined }) {
            state.transactionCostUSD = action.payload
        },
        setAttachmentOptions(state, action: { payload: IAttachmentOptions }) {
            state.attachmentOptions = action.payload
        },
        setErrorState(state, action: { payload: undefined }) {
            state.errorState = action.payload
        },
        setCrossChainDetails(state, action: { payload: [] | undefined }) {
            state.crossChainDetails = action.payload
        },
    },
})

export const sendFlowActions = sendFlowSlice.actions
export default sendFlowSlice.reducer

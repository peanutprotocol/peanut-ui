import { createSlice } from '@reduxjs/toolkit'
import { SEND_FLOW_SLICE } from '../constants'
import { ISendFlowState } from '../types/send-flow.types'

const initialState: ISendFlowState = {}

const sendFlowSlice = createSlice({
    name: SEND_FLOW_SLICE,
    initialState,
    reducers: {},
})

export const sendFlowActions = sendFlowSlice.actions
export default sendFlowSlice.reducer

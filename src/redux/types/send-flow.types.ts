import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

export type SendFlowView = 'INITIAL' | 'CONFIRM' | 'SUCCESS' | 'ERROR'

export type SendFlowTxnType = 'not-gasless' | 'gasless'

export type Recipient = { address: string | undefined; name: string | undefined }

export type IAttachmentOptions = {
    fileUrl: string | undefined
    message: string | undefined
    rawFile: File | undefined
}

export type ErrorState = {
    showError: boolean
    errorMessage: string
}
export interface ISendFlowState {
    view: SendFlowView
    tokenValue: string | undefined
    recipient: Recipient
    usdValue: string | undefined
    linkDetails: peanutInterfaces.IPeanutLinkDetails | undefined
    password: string | undefined
    transactionType: SendFlowTxnType
    estimatedPoints: number | undefined
    gaslessPayload: peanutInterfaces.IGaslessDepositPayload | undefined
    gaslessPayloadMessage: peanutInterfaces.IPreparedEIP712Message | undefined
    preparedDepositTxs: peanutInterfaces.IPrepareDepositTxsResponse | undefined
    txHash: string | undefined
    link: string | undefined
    transactionCostUSD: number | undefined
    attachmentOptions: IAttachmentOptions
    errorState: ErrorState | undefined
    crossChainDetails: [] | undefined
}

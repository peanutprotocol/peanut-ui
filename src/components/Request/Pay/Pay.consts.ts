import * as views from './Views'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

export type PayScreens = 'INITIAL' | 'SUCCESS'

export interface IPayScreenState {
    screen: PayScreens
    idx: number
}

export type IRequestLinkState = 'LOADING' | 'PAY' | 'ALREADY_PAID' | 'NOT_FOUND'

export const INIT_VIEW_STATE: IPayScreenState = {
    screen: 'INITIAL',
    idx: 0,
}

export const PAY_SCREEN_FLOW: PayScreens[] = ['INITIAL', 'SUCCESS']

export const PAY_SCREEN_MAP: { [key in PayScreens]: { comp: React.FC<any> } } = {
    INITIAL: { comp: views.InitialView },

    SUCCESS: { comp: views.SuccessView },
}

export interface IPayScreenProps {
    onNext: () => void
    onPrev: () => void
    requestLinkData: IRequestLinkData
    setEstimatedPoints: (value: number) => void
    estimatedPoints: number | undefined
    transactionHash: string
    setTransactionHash: (value: string) => void
    tokenPrice: number
    estimatedGasCost: number | undefined
    unsignedTx: peanutInterfaces.IPeanutUnsignedTransaction | undefined
}

export interface IRequestLinkData {
    uuid: string
    link: string
    chainId: string
    recipientAddress: string
    tokenAmount: string
    tokenAddress: string
    tokenDecimals: number
    tokenType: string
    tokenSymbol: string | null
    createdAt: string
    updatedAt: string
    reference: string | null
    attachmentUrl: string | null
    payerAddress: string | null
    trackId: string | null
    destinationChainFulfillmentHash: string | null
    originChainFulfillmentHash: string | null
    status: 'PENDING' | 'COMPLETED' | 'FAILED' // Add more status options if needed
}

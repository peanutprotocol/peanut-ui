import * as views from './Views'

export type PayScreens = 'INITIAL' | 'SUCCESS'

export interface IPayScreenState {
    screen: PayScreens
    idx: number
}

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
    estimatedPoints: number
    transactionHash: string
    setTransactionHash: (value: string) => void
}

export interface IRequestLinkData {
    attachmentInfo: {
        message: string | undefined
        attachmentUrl: string | undefined
    }
    requestAddress: string
    tokenPrice: number
    tokenAmount: string
    tokenSymbol: string
    tokenAddress: string
    chainId: string
}

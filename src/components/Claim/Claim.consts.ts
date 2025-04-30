import * as consts from '@/constants'
import * as interfaces from '@/interfaces'
import { IOfframpConfirmScreenProps, IOfframpSuccessScreenProps } from '../Offramp/Offramp.consts'
export type ClaimType = 'claim' | 'claimxchain'

export type ClaimScreens = 'INITIAL' | 'CONFIRM' | 'SUCCESS'

export interface IClaimScreenState {
    screen: ClaimScreens
    idx: number
}

export const INIT_VIEW_STATE: IClaimScreenState = {
    screen: 'INITIAL',
    idx: 0,
}

export const CLAIM_SCREEN_FLOW: ClaimScreens[] = ['INITIAL', 'CONFIRM', 'SUCCESS']

export interface IFlowManagerClaimComponents {
    INITIAL: ({}: IClaimScreenProps) => {}
    CONFIRM: (({}: IClaimScreenProps) => {}) | (({}: IOfframpConfirmScreenProps) => {})
    SUCCESS: (({}: IClaimScreenProps) => {}) | (({}: IOfframpSuccessScreenProps) => {})
}

export interface IClaimScreenProps {
    onPrev: () => void
    onNext: () => void
    onCustom: (screen: ClaimScreens) => void
    claimLinkData: interfaces.ILinkDetails
    type: ClaimType
    setClaimType: (type: ClaimType) => void
    recipient: { name: string | undefined; address: string }
    setRecipient: (recipient: { name: string | undefined; address: string }) => void
    tokenPrice: number
    setTokenPrice: (price: number) => void
    transactionHash: string
    setTransactionHash: (hash: string) => void
    estimatedPoints: number
    setEstimatedPoints: (points: number) => void
    attachment: { message: string | undefined; attachmentUrl: string | undefined }
    setAttachment: (attachment: { message: string | undefined; attachmentUrl: string | undefined }) => void
    selectedRoute: any
    setSelectedRoute: (route: any) => void
    hasFetchedRoute: boolean
    setHasFetchedRoute: (fetched: boolean) => void
    recipientType: interfaces.RecipientType
    setRecipientType: (type: interfaces.RecipientType) => void
    offrampForm: consts.IOfframpForm
    setOfframpForm: (form: consts.IOfframpForm) => void
    isOfframpPossible: boolean
    userType: 'NEW' | 'EXISTING' | undefined
    setUserType: (type: 'NEW' | 'EXISTING' | undefined) => void
    userId: string | undefined
    setUserId: (id: string | undefined) => void
    initialKYCStep: number
    setInitialKYCStep: (step: number) => void
}

export enum claimLinkStateType {
    LOADING = 'LOADING',
    CLAIM = 'CLAIM',
    ALREADY_CLAIMED = 'ALREADY_CLAIMED',
    NOT_FOUND = 'NOT_FOUND',
    CLAIM_SENDER = 'CLAIM_SENDER',
    WRONG_PASSWORD = 'WRONG_PASSWORD',
}

import * as views from './views'
import * as multilinkViews from './multilinkViews'
import * as interfaces from '@/interfaces'
export type linkState =
    | 'CLAIM'
    | 'NOT_FOUND'
    | 'ALREADY_CLAIMED'
    | 'LOADING'
    | 'MULTILINK_CLAIM'
    | 'MULTILINK_ALREADY_CLAIMED'

export type ClaimScreens = 'INITIAL' | 'SUCCESS'

export type MultilinkClaimScreens = 'INITIAL' | 'SUCCESS'

export interface IClaimScreenState {
    screen: ClaimScreens
    idx: number
}

export interface IClaimDetails {
    tokenAddress: string
    amount: number
    decimals: number
    chainId: number
}

export interface IClaimScreenProps {
    onNextScreen: () => void
    onCustomScreen: (screen: ClaimScreens) => void
    claimLink: string[]
    setClaimLink: (claimLink: string[]) => void
    claimDetails: interfaces.ILinkDetails[]
    txHash: string[]
    setTxHash: (txHash: string[]) => void
    claimType: 'CLAIM' | 'PROMO'
    setClaimType: (claimType: 'CLAIM' | 'PROMO') => void
    tokenPrice: string
    setTokenPrice: (tokenPrice: string) => void
}

export const INIT_VIEW: IClaimScreenState = {
    screen: 'INITIAL',
    idx: 0,
}

export const CLAIM_SCREEN_FLOW: ClaimScreens[] = ['INITIAL', 'SUCCESS']

export const CLAIM_SCREEN_MAP: {
    [key in ClaimScreens]: { comp: React.FC<any> }
} = {
    INITIAL: { comp: views.ClaimView },
    SUCCESS: { comp: views.ClaimSuccessView },
}

export const MULTILINK_CLAIM_SCREEN_FLOW: MultilinkClaimScreens[] = ['INITIAL', 'SUCCESS']

export const MULTILINK_CLAIM_SCREEN_MAP: {
    [key in MultilinkClaimScreens]: { comp: React.FC<any> }
} = {
    INITIAL: { comp: multilinkViews.MultilinkClaimView },
    SUCCESS: { comp: multilinkViews.multilinkSuccessView },
}

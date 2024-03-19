import * as views from './views'
import * as multilinkViews from './multilinkViews'
import * as xchainViews from './xchainViews'
import * as interfaces from '@/interfaces'

export type linkState =
    | 'CLAIM'
    | 'NOT_FOUND'
    | 'ALREADY_CLAIMED'
    | 'LOADING'
    | 'MULTILINK_CLAIM'
    | 'MULTILINK_ALREADY_CLAIMED'
    | 'XCHAIN_CLAIM'
    | 'XCHAIN_ALREADY_CLAIMED'

export type Screens = 'INITIAL' | 'SUCCESS'

export interface IClaimScreenState {
    screen: Screens
    idx: number
}

export interface IClaimDetails {
    tokenAddress: string
    amount: number
    decimals: number
    chainId: string
}

//Todo: remove these chain and token interfaces and use the ones from the SDK

interface Chain {
    chainId: string
    axelarChainName: string
    chainType: string
    chainIconURI: string
}

interface Token {
    chainId: string
    address: string
    name: string
    symbol: string
}

export interface ICrossChainSuccess {
    tokenName: string
    chainName: string
    chainId: string
}

export interface IClaimScreenProps {
    onNextScreen: () => void
    onCustomScreen: (screen: Screens) => void
    claimLink: string[]
    setClaimLink: (claimLink: string[]) => void
    claimDetails: interfaces.ILinkDetails[]
    txHash: string[]
    setTxHash: (txHash: string[]) => void
    claimType: 'CLAIM' | 'PROMO'
    setClaimType: (claimType: 'CLAIM' | 'PROMO') => void
    tokenPrice: string
    setTokenPrice: (tokenPrice: string) => void
    crossChainDetails: Array<Chain & { tokens: Token[] }>
    crossChainSuccess: ICrossChainSuccess | undefined
    setCrossChainSuccess: (crossChainSuccess: ICrossChainSuccess | undefined) => void
    senderAddress: string
    setSenderAddress: (senderAddress: string) => void
    recipientAddress: string
    setRecipientAddress: (recipientAddress: string) => void
}

export const INIT_VIEW: IClaimScreenState = {
    screen: 'INITIAL',
    idx: 0,
}

export const CLAIM_SCREEN_FLOW: Screens[] = ['INITIAL', 'SUCCESS']

export const CLAIM_SCREEN_MAP: {
    [key in Screens]: { comp: React.FC<any> }
} = {
    INITIAL: { comp: views.ClaimView },
    SUCCESS: { comp: views.ClaimSuccessView },
}

export const MULTILINK_CLAIM_SCREEN_FLOW: Screens[] = ['INITIAL', 'SUCCESS']

export const MULTILINK_CLAIM_SCREEN_MAP: {
    [key in Screens]: { comp: React.FC<any> }
} = {
    INITIAL: { comp: multilinkViews.MultilinkClaimView },
    SUCCESS: { comp: multilinkViews.multilinkSuccessView },
}

export const XCHAIN_CLAIM_SCREEN_FLOW: Screens[] = ['INITIAL', 'SUCCESS']

export const XCHAIN_CLAIM_SCREEN_MAP: {
    [key in Screens]: { comp: React.FC<any> }
} = {
    INITIAL: { comp: xchainViews.xchainClaimView },
    SUCCESS: { comp: xchainViews.xchainSuccessView },
}

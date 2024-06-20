import * as views from './Link'
import * as interfaces from '@/interfaces'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
export type ClaimType = 'claim' | 'claimxchain'

export type ClaimScreens = 'INITIAL' | 'CONFIRM' | 'SUCCESS'

export interface IOfframpForm {
    name: string
    email: string
    recipient: string
}

export interface IClaimScreenState {
    screen: ClaimScreens
    idx: number
}

export const INIT_VIEW_STATE: IClaimScreenState = {
    screen: 'INITIAL',
    idx: 0,
}

export const CLAIM_SCREEN_FLOW: ClaimScreens[] = ['INITIAL', 'CONFIRM', 'SUCCESS']

export interface IClaimScreenProps {
    onPrev: () => void
    onNext: () => void
    onCustom: (screen: ClaimScreens) => void
    claimLinkData: interfaces.ILinkDetails
    crossChainDetails: Array<peanutInterfaces.ISquidChain & { tokens: peanutInterfaces.ISquidToken[] }> | undefined
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
    offrampForm: IOfframpForm
    setOfframpForm: (form: IOfframpForm) => void
}

export type claimLinkState = 'LOADING' | 'CLAIM' | 'ALREADY_CLAIMED' | 'NOT_FOUND' | 'CLAIM_SENDER'

export const steps = [
    { title: 'TOS', description: 'Agree to the TOS', buttonText: 'Agree TOS' },
    { title: 'KYC', description: 'Complete KYC', buttonText: 'Complete KYC' },
    { title: 'Link Iban', description: 'Link IBAN to your account', buttonText: 'Link IBAN' },
]

export const chainDictionary = [
    {
        chain: 'arbitrum',
        chainId: '42161',
    },
    {
        chain: 'optimism',
        chainId: '10',
    },
    {
        chain: 'ethereum',
        chainId: '1',
    },
    {
        chain: 'polygon',
        chainId: '137',
    },
    // TODO: add avax
]

export const tokenArray = [
    {
        chainId: '137',
        tokens: [
            {
                token: 'usdc',
                address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            },
            {
                token: 'usdc',
                address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            },
            {
                token: 'usdt',
                address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            },
        ],
    },
    {
        chainId: '1',
        tokens: [
            {
                token: 'usdc',
                address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            },
            {
                token: 'usdt',
                address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            },
        ],
    },
    {
        chainId: '10',
        tokens: [
            {
                token: 'usdc',
                address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            },
            {
                token: 'usdc',
                address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
            },
            {
                token: 'usdt',
                address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            },
        ],
    },
    {
        chainId: '42161',
        tokens: [
            {
                token: 'usdc',
                address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
            },
            {
                token: 'usdc',
                address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            },
            {
                token: 'usdt',
                address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            },
        ],
    },
]

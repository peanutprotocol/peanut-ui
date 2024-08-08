import * as views from './Link'
import * as interfaces from '@/interfaces'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
export type ClaimType = 'claim' | 'claimxchain'

export type ClaimScreens = 'INITIAL' | 'CONFIRM' | 'SUCCESS'

export interface IOfframpForm {
    name: string
    email: string
    password: string
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
    liquidationAddress: interfaces.IBridgeLiquidationAddress | undefined
    setLiquidationAddress: (address: interfaces.IBridgeLiquidationAddress | undefined) => void
    isOfframpPossible: boolean
    peanutUser: any
    setPeanutUser: (user: any) => void
    peanutAccount: any
    setPeanutAccount: (account: any) => void
    offrampXchainNeeded: boolean
    setOfframpXchainNeeded: (needed: boolean) => void
    offrampChainAndToken: { chain: string; token: string }
    setOfframpChainAndToken: (chainAndToken: { chain: string; token: string }) => void
    userType: 'NEW' | 'EXISTING' | undefined
    setUserType: (type: 'NEW' | 'EXISTING' | undefined) => void
    userId: string | undefined
    setUserId: (id: string | undefined) => void
}

export type claimLinkState = 'LOADING' | 'CLAIM' | 'ALREADY_CLAIMED' | 'NOT_FOUND' | 'CLAIM_SENDER'

export const supportedBridgeChainsDictionary = [
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
    {
        chain: 'base',
        chainId: '8453',
    },
    {
        chain: 'avalanche',
        chainId: '43114',
    },
]

export const supportedBridgeTokensDictionary = [
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
        ],
    },
    {
        chainId: '43114',
        tokens: [
            {
                token: 'usdc',
                address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
            },
        ],
    },
    {
        chainId: '8453',
        tokens: [
            {
                token: 'usdc',
                address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            },
        ],
    },
]

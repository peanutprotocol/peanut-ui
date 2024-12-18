import * as consts from '@/constants'
import * as interfaces from '@/interfaces'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

export interface CrossChainDetails {
    chainId: string
    // ... ?
}

export interface LiquidationAddress {
    id: string
    address: string
    chain: string
    currency: string
    external_account_id: string
}

export interface PeanutAccount {
    account_id: string
}

export enum OfframpType {
    CASHOUT = 'CASHOUT',
    CLAIM = 'CLAIM',
}

export const MIN_CASHOUT_LIMIT = process.env.NODE_ENV === 'development' ? 0.9 : 10 // $1 in dev, $10 in prod
export const MAX_CASHOUT_LIMIT = 101000 // $101,000 maximum

export const usdcAddressOptimism = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'
export const optimismChainId = '10'

export interface IOfframpConfirmScreenProps {
    // available in all offramp types
    onPrev: () => void
    onNext: () => void
    offrampForm: consts.IOfframpForm
    setOfframpForm: (form: consts.IOfframpForm) => void
    initialKYCStep: number
    setTransactionHash: (hash: string) => void
    offrampType: OfframpType

    // available in cashout offramps
    usdValue?: string | undefined
    tokenValue?: string | undefined
    preparedCreateLinkWrapperResponse?:
        | {
              type: string
              response: any
              linkDetails: peanutInterfaces.IPeanutLinkDetails
              password: string
              feeOptions?: any
              usdValue?: string
          }
        | undefined

    // available in claim link offramps
    claimLinkData?: interfaces.ILinkDetails
    crossChainDetails?: Array<peanutInterfaces.ISquidChain & { tokens: peanutInterfaces.ISquidToken[] }> | undefined
    tokenPrice?: number
    estimatedPoints?: number
    attachment?: { message: string | undefined; attachmentUrl: string | undefined }
    recipientType?: interfaces.RecipientType
}

export interface IOfframpSuccessScreenProps {
    // available in all offramp types
    offrampForm: consts.IOfframpForm
    offrampType: OfframpType

    // available in cashout offramps
    usdValue?: string | undefined

    // available in claim link offramps
    claimLinkData?: interfaces.ILinkDetails
    tokenPrice?: number
    recipientType?: interfaces.RecipientType
    transactionHash?: string
}

export const VALID_PROMO_CODES = [
    'XMAS',
    'GONUTS',
    'PEANUTFREN',
    'CLUBPEANUT',
    'DISCORD',
    'W3HUB',
    'MINDSPACE',
    'FULLNODE',
    'HUCKLETREE',
    'THURSDAO',
    'STATIONF',
    'HEDEN',
    'THEBLOCK',
    'BASEDINLISBON',
    'THEFINTECHHOUSE',
    'KUBECOWORKING',
    'CVLABS',
    'ATICOLAB',
    'UNYTED',
    'WEB3FAMILY',
    'ONECOWORK',
    'LAVACACOWORKING',
    'CRYPTODAYS',
    'SECONDCULTURE',
    'DECENTRALHOUSE',
    'BONCESPACE',
    'TRIBESCOWORK',
    'POWSPACE',
    'DEHOUSE',
    'WORKIN',
    'HOUSEOFBLOCKCHAIN',
    'SUBWORK',
    'POOLSIDE',
    'CAHOOTCOWORK',
    'NIFTYCLUB',
    'SPACESHACK',
]

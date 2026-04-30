import type { ILinkDetails, RecipientType } from '@/interfaces/interfaces'
import * as peanutInterfaces from '@/interfaces/peanut-sdk-types'
import type { ChainWithTokens } from '@/interfaces/chain-meta'
import type { IOfframpForm } from '@/constants/cashout.consts'

export enum OfframpType {
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
    offrampForm: IOfframpForm
    setOfframpForm: (form: IOfframpForm) => void
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
    claimLinkData?: ILinkDetails
    crossChainDetails?: Array<ChainWithTokens> | undefined
    tokenPrice?: number
    estimatedPoints?: number
    attachment?: { message: string | undefined; attachmentUrl: string | undefined }
    recipientType?: RecipientType
    appliedPromoCode?: string | null
    onPromoCodeApplied: (code: string | null) => void
    estimatedGasCost?: string
}

export interface IOfframpSuccessScreenProps {
    // available in all offramp types
    offrampForm: IOfframpForm
    offrampType: OfframpType

    // available in cashout offramps
    usdValue?: string | undefined

    // available in claim link offramps
    claimLinkData?: ILinkDetails
    tokenPrice?: number
    recipientType?: RecipientType
    transactionHash?: string
    appliedPromoCode?: string | null
}

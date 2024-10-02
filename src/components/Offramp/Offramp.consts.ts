import * as consts from '@/constants'
import * as interfaces from '@/interfaces'

export enum OfframpType {
    CASHOUT = 'CASHOUT',
    CLAIM = 'CLAIM'
}

export const usdcAddressOptimism = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'
export const optimismChainId = '10'

export interface IOfframpSuccessScreenProps {
    usdValue?: string | undefined
    offrampForm: consts.IOfframpForm
    transactionHash?: string
    claimLinkData?: interfaces.ILinkDetails
    tokenPrice?: number
    recipientType?: interfaces.RecipientType
    offrampType: OfframpType
}

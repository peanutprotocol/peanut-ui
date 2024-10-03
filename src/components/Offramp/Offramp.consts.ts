import * as consts from '@/constants'
import * as interfaces from '@/interfaces'

export enum OfframpType {
    CASHOUT = 'CASHOUT',
    CLAIM = 'CLAIM'
}

export const usdcAddressOptimism = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'
export const optimismChainId = '10'

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

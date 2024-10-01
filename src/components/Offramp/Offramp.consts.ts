import * as consts from '@/constants'
import * as interfaces from '@/interfaces'

export enum OfframpType {
    CASHOUT = 'CASHOUT',
    CLAIM = 'CLAIM'
}

export interface IOfframpSuccessScreenProps {
    usdValue?: string | undefined
    offrampForm: consts.IOfframpForm
    transactionHash?: string
    claimLinkData?: interfaces.ILinkDetails
    tokenPrice?: number
    recipientType?: interfaces.RecipientType
    offrampType: OfframpType
}

import { ParsedURL } from '@/lib/url-parser/types/payment'
import { PaymentCreationResponse, TCharge, TRequestChargeResponse, TRequestResponse } from '@/services/services.types'
import { IAttachmentOptions } from './send-flow.types'

export type TPaymentView = 'INITIAL' | 'CONFIRM' | 'STATUS' | 'PUBLIC_PROFILE'

export interface IPaymentState {
    currentView: TPaymentView
    attachmentOptions: IAttachmentOptions
    parsedPaymentData: ParsedURL | null
    requestDetails: TRequestResponse | null
    transactionHash: string | null
    paymentDetails: PaymentCreationResponse | null
    chargeDetails: TRequestChargeResponse | null
    createdChargeDetails: TCharge | null
    resolvedAddress: string | null
    error: string | null
    beerQuantity: number
    usdAmount: string | null
}

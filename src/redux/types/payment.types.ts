import { IAttachmentOptions } from '@/components/Create/Create.consts'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { PaymentCreationResponse, TCharge, TRequestChargeResponse, TRequestResponse } from '@/services/services.types'

export type TPaymentView = 'INITIAL' | 'CONFIRM' | 'STATUS'

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
}

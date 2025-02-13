import { IAttachmentOptions } from '@/components/Create/Create.consts'
import { IRequestLinkData } from '@/components/Request/Pay/Pay.consts'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { PaymentCreationResponse } from '@/services/services.types'

export interface IPaymentState {
    currentView: number
    attachmentOptions: IAttachmentOptions
    urlParams: ParsedURL | null
    requestDetails: IRequestLinkData | null
    transactionHash: string | null
    paymentDetails: PaymentCreationResponse | null
}

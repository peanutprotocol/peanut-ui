import * as interfaces from '@/interfaces'
import { CrossChainDetails } from './services/cross-chain';
import * as _consts from './Claim.consts'

export type Attachement = { message: string | undefined; attachmentUrl: string | undefined }

export type CheckLinkReturnType = {
    linkDetails: interfaces.ILinkDetails | undefined
    attachmentInfo: Attachement
    crossChainDetails?: CrossChainDetails
    tokenPrice: number
    estimatedPoints: number
    recipient: { name: string | undefined; address: string }
    linkState: _consts.claimLinkState
}
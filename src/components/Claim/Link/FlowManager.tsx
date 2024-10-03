import { createElement } from 'react'
import * as onchainViews from './Onchain'
import { InitialClaimLinkView } from './Initial.view'
import * as _consts from '../Claim.consts'
import * as interfaces from '@/interfaces'
import { OfframpConfirmView, OfframpSuccessView } from '@/components/Offramp'
import { IOfframpConfirmScreenProps, IOfframpSuccessScreenProps, OfframpType } from '@/components/Offramp/Offramp.consts'

type ClaimPropsType = _consts.IClaimScreenProps | IOfframpSuccessScreenProps | IOfframpConfirmScreenProps

const FlowManager = ({
    recipientType,
    step,
    props,
}: {
    recipientType: interfaces.RecipientType
    step: _consts.IClaimScreenState
    props: _consts.IClaimScreenProps
}) => {
    const viewComponents: _consts.IFlowManagerClaimComponents = {
        INITIAL: InitialClaimLinkView,
        CONFIRM:
            recipientType != 'iban' && recipientType != 'us'
                ? onchainViews.ConfirmClaimLinkView
                : OfframpConfirmView,
        SUCCESS:
            recipientType != 'iban' && recipientType != 'us'
                ? onchainViews.SuccessClaimLinkView
                : OfframpSuccessView
    }

    let componentProps:  ClaimPropsType = props
    if (recipientType == 'iban' || recipientType == 'us') {
        componentProps = {
            ...props,
            offrampType: OfframpType.CLAIM // adds an additional required type on the props
        }
    }

    return createElement(
        viewComponents[step.screen] as React.FC<ClaimPropsType>, 
        componentProps
    )


}

export default FlowManager

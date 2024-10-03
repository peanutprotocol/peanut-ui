import { createElement } from 'react'
import * as onchainViews from './Onchain'
import * as offrampViews from './Offramp'
import { InitialClaimLinkView } from './Initial.view'
import * as _consts from '../Claim.consts'
import * as interfaces from '@/interfaces'
import { OfframpConfirmView, OfframpSuccessView } from '@/components/Offramp'
import { IOfframpSuccessScreenProps, OfframpType } from '@/components/Offramp/Offramp.consts'


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

    let componentProps:  _consts.IClaimScreenProps | IOfframpSuccessScreenProps = props
    if (recipientType == 'iban' || recipientType == 'us') {
        componentProps = {
            ...props,
            offrampType: OfframpType.CLAIM // adds an additional required type on the props
        }
    }

    return createElement(
        viewComponents[step.screen] as React.FC<_consts.IClaimScreenProps | IOfframpSuccessScreenProps>, 
        componentProps
    )


}

export default FlowManager

import { createElement } from 'react'
import * as onchainViews from './Onchain'
import { InitialClaimLinkView } from './Initial.view'
import * as _consts from '../Claim.consts'
import * as interfaces from '@/interfaces'
import { OfframpSuccessView } from '@/components/Offramp'
import { IOfframpSuccessScreenProps, OfframpType } from '@/components/Offramp/Offramp.consts'

type ClaimPropsType = _consts.IClaimScreenProps | IOfframpSuccessScreenProps

const FlowManager = ({
    recipientType,
    step,
    props,
}: {
    recipientType: interfaces.RecipientType
    step: _consts.IClaimScreenState
    props: _consts.IClaimScreenProps & { appliedPromoCode?: string | null }
}) => {
    const viewComponents: _consts.IFlowManagerClaimComponents = {
        INITIAL: InitialClaimLinkView,
        SUCCESS:
            recipientType !== 'iban' && recipientType !== 'us' ? onchainViews.SuccessClaimLinkView : OfframpSuccessView,
    }

    let componentProps: ClaimPropsType = props
    if (recipientType === 'iban' || recipientType === 'us') {
        componentProps = {
            ...props,
            offrampType: OfframpType.CLAIM,
            appliedPromoCode: props.appliedPromoCode,
        }
    }

    return createElement(viewComponents[step.screen] as React.FC<ClaimPropsType>, componentProps)
}

export default FlowManager

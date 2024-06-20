// components/FlowManager.tsx
import { createElement } from 'react'
import * as onchainViews from './Onchain'
import * as offrampViews from './Offramp'
import { InitialClaimLinkView } from './Initial.view'
import * as _consts from '../Claim.consts'
import * as interfaces from '@/interfaces'

const FlowManager = ({
    recipientType,
    step,
    props,
}: {
    recipientType: interfaces.RecipientType
    step: _consts.IClaimScreenState
    props: _consts.IClaimScreenProps
}) => {
    console.log(recipientType)
    const viewComponents = {
        INITIAL: InitialClaimLinkView,
        CONFIRM:
            recipientType != ('iban' && 'us')
                ? onchainViews.ConfirmClaimLinkView
                : offrampViews.ConfirmClaimLinkIbanView,
        SUCCESS:
            recipientType != ('iban' && 'us')
                ? onchainViews.SuccessClaimLinkView
                : offrampViews.SuccessClaimLinkIbanView,
    }

    return createElement(viewComponents[step.screen], props)
}

export default FlowManager

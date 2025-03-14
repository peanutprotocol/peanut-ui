import { Button } from '@/components/0_Bruddle'
import FlowHeader from '@/components/Global/FlowHeader'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import BeerInput from '../BeerInput'
import PintaReqViewWrapper from '../PintaReqViewWrapper'

const PintaReqPayInitialView = ({ recipient, amount, token, chain }: ParsedURL) => {
    const dispatch = useAppDispatch()
    const { beerQuantity } = usePaymentStore()

    return (
        <div>
            <div className="space-y-4">
                <FlowHeader isPintaReq={token?.symbol === 'PNT'} disableWalletHeader />

                <PintaReqViewWrapper view="INITIAL">
                    <BeerInput />
                    <Button
                        variant="purple"
                        onClick={() => dispatch(paymentActions.setView('CONFIRM'))}
                        disabled={beerQuantity === 0}
                    >
                        Confirm
                    </Button>
                </PintaReqViewWrapper>
            </div>
        </div>
    )
}

export default PintaReqPayInitialView

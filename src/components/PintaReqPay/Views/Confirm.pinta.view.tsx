import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import FlowHeader from '@/components/Global/FlowHeader'
import PeanutSponsored from '@/components/Global/PeanutSponsored'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import PintaReqViewWrapper from '../PintaReqViewWrapper'

const PintaReqPayConfirmView = () => {
    const dispatch = useAppDispatch()
    const { beerQuantity } = usePaymentStore()
    return (
        <div>
            <div className="space-y-4">
                <FlowHeader
                    onPrev={() => {
                        dispatch(paymentActions.setView('INITIAL'))
                        dispatch(paymentActions.setBeerQuantity(0))
                    }}
                    disableWalletHeader
                />

                <PintaReqViewWrapper view="INITIAL">
                    <div className="flex flex-col items-center justify-center gap-3 pt-2">
                        <div className="text-h8">You're Claiming</div>
                        <div className="space-y-2 text-center">
                            <div className="text-h5 font-bold">
                                {beerQuantity} {beerQuantity > 1 ? 'Beers' : 'Beer'}
                            </div>
                            <p className="text-xs font-normal">From Beer Account</p>
                        </div>
                    </div>
                    <PeanutSponsored />
                    <Divider />
                    <Button variant="purple">Confirm</Button>
                </PintaReqViewWrapper>
            </div>
        </div>
    )
}

export default PintaReqPayConfirmView

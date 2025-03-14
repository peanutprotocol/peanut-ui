import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import FlowHeader from '@/components/Global/FlowHeader'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import Link from 'next/link'
import PintaReqViewWrapper from '../PintaReqViewWrapper'

const PintaReqPaySuccessView = () => {
    const dispatch = useAppDispatch()
    const { beerQuantity } = usePaymentStore()
    const remainingBeers = 100 - beerQuantity
    return (
        <div>
            <div className="space-y-4">
                <FlowHeader
                    onPrev={() => {
                        dispatch(paymentActions.setView('CONFIRM'))
                    }}
                    disableWalletHeader
                />

                <PintaReqViewWrapper view="SUCCESS">
                    <div className="flex flex-col items-center justify-center gap-3 pt-2">
                        <div className="text-h8">You have</div>
                        <div className="space-y-2 text-center">
                            <div className="text-h5 font-bold">
                                {remainingBeers} {remainingBeers > 1 ? 'Beers' : 'Beer'}
                            </div>
                            <p className="text-xs font-semibold">remaining</p>
                        </div>
                    </div>
                    <Divider />
                    <Link href={'/home'} className="block">
                        <Button variant="purple">Back to home</Button>
                    </Link>
                </PintaReqViewWrapper>
            </div>
        </div>
    )
}

export default PintaReqPaySuccessView

'use client'

import PaymentHistory from '@/components/Payment/History'
import ConfirmPaymentView from '@/components/Payment/Views/Confirm.payment.view'
import InitialPaymentView from '@/components/Payment/Views/Initial.payment.view'
import SuccessPaymentView from '@/components/Payment/Views/Sucess.payment.view'
import { usePaymentStore } from '@/redux/hooks'

export default function PaymentPage() {
    // todo: this is temprory for demoing the payment flow, will be removed
    const { currentView } = usePaymentStore()
    // test error.tsx page
    // throw new Error('This is a test error')

    return (
        <div className="mx-auto w-full space-y-8 md:w-6/12">
            <div>
                {currentView === 1 && <InitialPaymentView />}
                {currentView === 2 && <ConfirmPaymentView />}
                {currentView === 3 && <SuccessPaymentView />}
            </div>
            <div>
                <PaymentHistory />
            </div>
        </div>
    )
}

{
    /* <div className="relative flex w-full items-start justify-around gap-6 self-start">
<div className="sticky top-0 w-6/12">
    {currentView === 1 && <InitialPaymentView />}
    {currentView === 2 && <ConfirmPaymentView />}
    {currentView === 3 && <SuccessPaymentView />}
</div>
<div className="w-6/12">
    <PaymentHistory />
</div>
</div> */
}

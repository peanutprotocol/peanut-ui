'use client'

import PaymentHistory from '@/components/Payment/History'
import ConfirmPaymentView from '@/components/Payment/Views/Confirm.payment.view'
import InitialPaymentView from '@/components/Payment/Views/Initial.payment.view'
import SuccessPaymentView from '@/components/Payment/Views/Sucess.payment.view'
import { parsePaymentURL } from '@/lib/url-parser/parser'
import { validatePaymentParams } from '@/lib/validation/payment'
import { usePaymentStore } from '@/redux/hooks'
import { Suspense } from 'react'

// todo: temporary, remove this
function makeSerializable<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj, (_, value) => (typeof value === 'bigint' ? value.toString() : value)))
}

export default async function PaymentPage({ params }: { params: { recipient: string[] } }) {
    const { currentView } = usePaymentStore()

    // todo: note, parsing is a bit slow, do it only once or find a better solution here to optimize and avoid re-parsing

    try {
        // parse the URL
        const parsedURL = parsePaymentURL(params.recipient)
        console.log('Parsed URL:', parsedURL)

        // Validate the parameters
        const validatedPayment = await validatePaymentParams(parsedURL)

        // convert BigInt to string for JSON serialization
        const serializablePayment = makeSerializable(validatedPayment)
        console.log('Validated Payment:', serializablePayment)

        return (
            <Suspense fallback={<div>Loading...</div>}>
                <div className="w-full space-y-10">
                    {/* todo: remove this */}
                    <div className="mx-auto w-full space-y-8 md:w-6/12 ">
                        <h1>Payment Page</h1>
                        <pre>{JSON.stringify(parsedURL, null, 2)}</pre>
                        <hr />
                        {/* <pre>{JSON.stringify(serializablePayment, null, 2)}</pre> */}
                    </div>

                    <div className="mx-auto w-full space-y-8 md:w-6/12 ">
                        <div>
                            {currentView === 1 && <InitialPaymentView {...parsedURL} />}
                            {currentView === 2 && <ConfirmPaymentView />}
                            {currentView === 3 && <SuccessPaymentView />}
                        </div>
                        <div>
                            <PaymentHistory />
                        </div>
                    </div>
                </div>
            </Suspense>
        )
    } catch (error) {
        console.error('Error:', error)
        return <div>Error: {error instanceof Error ? error.message : 'Unknown error'}</div>
    }
}

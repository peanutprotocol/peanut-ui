'use client'

import PaymentHistory from '@/components/Payment/History'
import ConfirmPaymentView from '@/components/Payment/Views/Confirm.payment.view'
import InitialPaymentView from '@/components/Payment/Views/Initial.payment.view'
import SuccessPaymentView from '@/components/Payment/Views/Success.payment.view'
import { parsePaymentURL } from '@/lib/url-parser/parser'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { validatePaymentParams } from '@/lib/validation/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { useEffect, useMemo, useState } from 'react'

export default function PaymentPage({ params }: { params: { recipient: string[] } }) {
    const dispatch = useAppDispatch()
    const { currentView } = usePaymentStore()
    const [error, setError] = useState<Error | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // avoid re-parsing the URL on every render
    const parsedURL = useMemo(() => {
        try {
            const parsed = parsePaymentURL(params.recipient)
            dispatch(paymentActions.setUrlParams(parsed))
            return parsed
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to parse URL'))
            return null
        }
    }, [params.recipient, dispatch])

    // handle validation
    useEffect(() => {
        if (!parsedURL) return

        async function validatePayment() {
            try {
                await validatePaymentParams(parsedURL as ParsedURL)
            } catch (err) {
                setError(err instanceof Error ? err : new Error('Failed to validate payment'))
            } finally {
                setIsLoading(false)
            }
        }

        validatePayment()
    }, [parsedURL])

    if (error) {
        return <div>Error: {error.message}</div>
    }

    if (isLoading || !parsedURL) {
        return <div>Loading...</div>
    }

    return (
        <div className="mx-auto w-full space-y-8 md:w-6/12 ">
            <div>
                {currentView === 1 && <InitialPaymentView {...(parsedURL as ParsedURL)} />}
                {currentView === 2 && <ConfirmPaymentView />}
                {currentView === 3 && <SuccessPaymentView />}
            </div>
            <div>
                <PaymentHistory recipient={parsedURL.recipient} />
            </div>
        </div>
    )
}

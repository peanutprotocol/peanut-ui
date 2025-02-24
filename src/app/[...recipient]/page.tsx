'use client'

import PeanutLoading from '@/components/Global/PeanutLoading'
import PaymentHistory from '@/components/Payment/History'
import ConfirmPaymentView from '@/components/Payment/Views/Confirm.payment.view'
import ValidationErrorView from '@/components/Payment/Views/Error.validation.view'
import InitialPaymentView from '@/components/Payment/Views/Initial.payment.view'
import PaymentStatusView from '@/components/Payment/Views/Payment.status.view'
import { parsePaymentURL } from '@/lib/url-parser/parser'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function PaymentPage({ params }: { params: { recipient: string[] } }) {
    const dispatch = useAppDispatch()
    const { currentView, requestDetails, parsedPaymentData, chargeDetails } = usePaymentStore()
    const [error, setError] = useState<Error | null>(null)
    const [isUrlParsed, setIsUrlParsed] = useState(false)
    const searchParams = useSearchParams()
    const router = useRouter()
    const chargeId = searchParams.get('chargeId')
    const requestId = searchParams.get('id')

    const parsedURL = useMemo(async () => {
        try {
            const parsed = await parsePaymentURL(params.recipient)
            return parsed
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to parse URL'))
            return null
        }
    }, [params.recipient])

    useEffect(() => {
        parsedURL.then(() => setIsUrlParsed(true))
    }, [parsedURL])

    useEffect(() => {
        const fetchParsedURL = async () => {
            const result = await parsedURL
            dispatch(paymentActions.setParsedPaymentData(result as ParsedURL))
        }

        fetchParsedURL()
    }, [dispatch])

    // handle validation and charge creation
    useEffect(() => {
        // always show initial view, to let payer select token/chain of choice
        if (chargeId) {
            chargesApi
                .get(chargeId)
                .then((charge) => {
                    dispatch(paymentActions.setChargeDetails(charge))

                    // check latest payment status if payments exist
                    if (charge.payments && charge.payments.length > 0) {
                        const latestPayment = charge.payments[charge.payments.length - 1]

                        // show STATUS view for any payment attempt (including failed ones)
                        if (latestPayment.status !== 'NEW') {
                            dispatch(paymentActions.setView('STATUS'))
                        }
                    }
                })
                .catch((err) => {
                    setError(err instanceof Error ? err : new Error('Failed to fetch charge'))
                })
        }
    }, [chargeId, dispatch])

    // fetch requests for the recipient
    useEffect(() => {
        async function fetchRequests() {
            if (!parsedPaymentData?.recipient) return

            try {
                let recipientIdentifier: string | null = parsedPaymentData.recipient.identifier

                if (!recipientIdentifier) {
                    throw new Error('Not a valid recipient')
                }

                const tokenAddress =
                    parsedPaymentData.token && parsedPaymentData.chain && parsedPaymentData.token.address

                const chainId = parsedPaymentData?.chain?.chainId ? parsedPaymentData?.chain?.chainId : undefined

                //  conditional request params
                const requestParams: any = { recipient: recipientIdentifier }
                if (parsedPaymentData.amount) requestParams.tokenAmount = parsedPaymentData.amount
                if (chainId) requestParams.chainId = chainId
                if (tokenAddress) requestParams.tokenAddress = tokenAddress

                // fetch requests using the resolved address
                const fetchedRequest = await requestsApi.search(requestParams)

                dispatch(paymentActions.setRequestDetails(fetchedRequest))
            } catch (error) {
                console.error('Failed to fetch requests:', error)
                setError(error instanceof Error ? error : new Error('Failed to fetch requests'))
            }
        }

        fetchRequests()
    }, [
        parsedPaymentData?.recipient,
        parsedPaymentData?.chain,
        parsedPaymentData?.token,
        parsedPaymentData?.amount,
        dispatch,
    ])

    // fetch request details if request ID is available
    useEffect(() => {
        if (requestId) {
            requestsApi
                .get(requestId)
                .then((request) => {
                    dispatch(paymentActions.setRequestDetails(request))

                    // check if any charge has payments (including pending ones)
                    const hasPayments = request.charges?.some((charge) => charge.payments?.length > 0)

                    if (hasPayments) {
                        dispatch(paymentActions.setView('STATUS'))
                    }
                })
                .catch((err) => {
                    setError(err instanceof Error ? err : new Error('Invalid request ID'))
                })
        }
    }, [requestId, dispatch])

    if (error) {
        return (
            <div className="mx-auto h-full w-full space-y-8 self-center md:w-6/12">
                <ValidationErrorView />
            </div>
        )
    }

    // show loading until URL is parsed and req/charge data is loaded
    const isLoading = !isUrlParsed || (chargeId && !chargeDetails) || (requestId && !requestDetails)
    if (isLoading) {
        return <PeanutLoading />
    }

    return (
        <div
            className={twMerge(
                'mx-auto h-full w-full space-y-8 self-start md:w-6/12',
                currentView !== 'INITIAL' && 'self-center'
            )}
        >
            <div>
                {currentView === 'INITIAL' && <InitialPaymentView {...(parsedPaymentData as ParsedURL)} />}
                {currentView === 'CONFIRM' && (
                    <div className="self-start">
                        <ConfirmPaymentView />
                    </div>
                )}
                {currentView === 'STATUS' && <PaymentStatusView />}
            </div>
            {currentView === 'INITIAL' && (
                <div>
                    {parsedPaymentData?.recipient && (
                        <PaymentHistory
                            history={requestDetails?.history || []}
                            recipient={parsedPaymentData.recipient}
                        />
                    )}
                </div>
            )}
        </div>
    )
}

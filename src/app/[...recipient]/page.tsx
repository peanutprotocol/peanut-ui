'use client'

import PeanutLoading from '@/components/Global/PeanutLoading'
import PaymentHistory from '@/components/Payment/History'
import ChargeStatusView from '@/components/Payment/Views/Charge.status.view'
import ConfirmPaymentView from '@/components/Payment/Views/Confirm.payment.view'
import ValidationErrorView from '@/components/Payment/Views/Error.validation.view'
import InitialPaymentView from '@/components/Payment/Views/Initial.payment.view'
import RequestStatusView from '@/components/Payment/Views/Request.status.view'
import { parsePaymentURL } from '@/lib/url-parser/parser'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function PaymentPage({ params }: { params: { recipient: string[] } }) {
    const dispatch = useAppDispatch()
    const { currentView, attachmentOptions, resolvedAddress, requestDetails, parsedPaymentData } = usePaymentStore()
    const [error, setError] = useState<Error | null>(null)
    const [isLoadingCharge, setIsLoadingCharge] = useState(true)
    const [isLoadingRequests, setIsLoadingRequests] = useState(true)
    const searchParams = useSearchParams()
    const router = useRouter()
    const chargeId = searchParams.get('chargeId')
    const requestId = searchParams.get('id')
    const [supportedSquidChainsAndTokens, setSupportedSquidChainsAndTokens] = useState<
        Record<string, interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }>
    >({})
    // const [parsedURL, setParsedURL] = useState<any>(null)

    // console.log('supportedSquidChainsAndTokens', supportedSquidChainsAndTokens)

    console.log('params: ', params)
    const parsedURL = useMemo(async () => {
        try {
            const params1 = {
                recipient: ['kushagrasarathe.eth'],
            }
            const params2 = {
                recipient: ['kushagrasarathe.eth%40base'],
            }
            const params3 = {
                recipient: ['kushagrasarathe.eth%40base', '0.1'],
            }
            const params4 = {
                recipient: ['kushagrasarathe.eth%40base', 'usdc'],
            }
            const params5 = {
                recipient: ['kushagrasarathe.eth', '0.1'],
            }
            const params6 = {
                recipient: ['kushagrasarathe.eth', '0.1usdc'],
            }
            const params7 = {
                recipient: ['kushagrasarathe.eth%40base', '0.1usdc'],
            }

            // const parsed = await parsePaymentURL(params7.recipient)
            const parsed = await parsePaymentURL(params.recipient)

            // dispatch(paymentActions.setUrlParams(parsed))

            return parsed
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to parse URL'))
            return null
        }
    }, [params.recipient])

    // console.log('_paresedURL', _paresedURL)

    useEffect(() => {
        const fetchParsedURL = async () => {
            const result = await parsedURL
            dispatch(paymentActions.setParsedPaymentData(result as ParsedURL))
        }

        fetchParsedURL()
    }, [dispatch])

    console.log('paresedURL', parsedPaymentData)

    // handle validation and charge creation
    useEffect(() => {
        // always show initial view, to let payer select token/chain of choice
        if (chargeId) {
            setIsLoadingCharge(true)
            chargesApi
                .get(chargeId)
                .then((charge) => {
                    dispatch(paymentActions.setChargeDetails(charge))

                    // check latest payment status if payments exist
                    if (charge.payments && charge.payments.length > 0) {
                        const latestPayment = charge.payments[charge.payments.length - 1]

                        // show success view for any payment attempt (including failed ones)
                        if (latestPayment.status !== 'NEW') {
                            dispatch(paymentActions.setView('STATUS'))
                        }
                    }
                })
                .catch((err) => {
                    setError(err instanceof Error ? err : new Error('Failed to fetch charge'))
                })
                .finally(() => {
                    setIsLoadingCharge(false)
                })
        } else {
            setIsLoadingCharge(false)
        }
    }, [chargeId, dispatch])

    // fetch requests for the recipient
    useEffect(() => {
        async function fetchRequests() {
            if (!parsedPaymentData?.recipient) return

            setIsLoadingRequests(true)
            try {
                let recipientAddress: string | null = parsedPaymentData.recipient.resolvedAddress

                // resolve the recipient if its not an address
                // if (!isAddress(parsedURL.recipient)) {
                //     try {
                //         // let nameToResolve = parsedURL.recipient

                //         // remove chain part if present (after @)
                //         // if (nameToResolve.includes('@')) {
                //         //     nameToResolve = nameToResolve.split('@')[0]
                //         // }

                //         // if username has no dots, treat as native peanut username
                //         // if (!nameToResolve.includes('.')) {
                //         //     nameToResolve = `${nameToResolve}.${JUSTANAME_ENS}`
                //         // }

                //         // const resolved = await resolveFromEnsName(nameToResolve)
                //         // if (!resolved) {
                //         //     throw new Error('Could not resolve recipient name')
                //         // }
                //         recipientAddress = resolved
                //         // store resolved address in redux
                //         dispatch(paymentActions.setResolvedAddress(resolved))
                //     } catch (error) {
                //         console.error('Failed to resolve recipient:', error)
                //         setError(new Error('Invalid recipient name'))
                //         return
                //     }
                // } else {
                //     recipientAddress = parsedURL.recipient
                // }

                if (!recipientAddress) {
                    throw new Error('No valid recipient address')
                }

                const tokenAddress =
                    parsedPaymentData.token && parsedPaymentData.chain && parsedPaymentData.token.address

                const chainId = parsedPaymentData?.chain?.chainId ? parsedPaymentData?.chain?.chainId : undefined

                //  conditional request params
                const requestParams: any = { recipient: recipientAddress }
                if (parsedPaymentData.amount) requestParams.tokenAmount = parsedPaymentData.amount
                if (chainId) requestParams.chainId = chainId
                if (tokenAddress) requestParams.tokenAddress = tokenAddress

                // fetch requests using the resolved address
                const fetchedRequest = await requestsApi.search(requestParams)

                dispatch(paymentActions.setRequestDetails(fetchedRequest))
            } catch (error) {
                console.error('Failed to fetch requests:', error)
                setError(error instanceof Error ? error : new Error('Failed to fetch requests'))
            } finally {
                setIsLoadingRequests(false)
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
            setIsLoadingRequests(true)
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
                .finally(() => {
                    setIsLoadingRequests(false)
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

    // show loading state wen reqs are being fetched or chargeId is present but currentView is not set yet
    if (isLoadingCharge || isLoadingRequests || (chargeId && !currentView)) {
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
                {currentView === 'STATUS' && (requestId ? <RequestStatusView /> : <ChargeStatusView />)}
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

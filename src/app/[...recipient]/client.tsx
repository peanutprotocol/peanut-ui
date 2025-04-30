'use client'

import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import PaymentHistory from '@/components/Payment/History'
import ConfirmPaymentView from '@/components/Payment/Views/Confirm.payment.view'
import ValidationErrorView, { ValidationErrorViewProps } from '@/components/Payment/Views/Error.validation.view'
import InitialPaymentView from '@/components/Payment/Views/Initial.payment.view'
import PaymentStatusView from '@/components/Payment/Views/Payment.status.view'
import PintaReqPaySuccessView from '@/components/PintaReqPay/Views/Success.pinta.view'
import PublicProfile from '@/components/Profile/components/PublicProfile'
import { useAuth } from '@/context/authContext'
import { EParseUrlError, parsePaymentURL, ParseUrlError } from '@/lib/url-parser/parser'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { formatAmount } from '@/utils'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface Props {
    recipient: string[]
}

export default function PaymentPage({ recipient }: Props) {
    const dispatch = useAppDispatch()
    const { currentView, requestDetails, parsedPaymentData, chargeDetails } = usePaymentStore()
    const [error, setError] = useState<ValidationErrorViewProps | null>(null)
    const [isUrlParsed, setIsUrlParsed] = useState(false)
    const { user } = useAuth()
    const searchParams = useSearchParams()
    const chargeId = searchParams.get('chargeId')
    const requestId = searchParams.get('id')
    const [showPaymentView, setShowPaymentView] = useState(false)

    useEffect(() => {
        let isMounted = true
        const fetchParsedURL = async () => {
            const { parsedUrl, error } = await parsePaymentURL(recipient)

            if (!isMounted) return

            if (parsedUrl) {
                dispatch(
                    paymentActions.setParsedPaymentData({
                        ...parsedUrl,
                        amount: parsedUrl.amount ? formatAmount(parsedUrl.amount || '') : undefined,
                    })
                )
                setIsUrlParsed(true)
            } else {
                setError(getErrorProps({ error, isUser: !!user }))
            }
        }

        fetchParsedURL()
        return () => {
            isMounted = false
        }
    }, [recipient, user])

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
                .catch((_err) => {
                    setError(getDefaultError(!!user))
                })
        }
    }, [chargeId])

    // fetch requests for the recipient only when id is not available in the URL
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

                // only include amount in search params if explicitly provided in URL
                if (parsedPaymentData.amount && parsedPaymentData.amount !== '') {
                    requestParams.tokenAmount = parsedPaymentData.amount
                }

                if (chainId) requestParams.chainId = chainId
                if (tokenAddress) requestParams.tokenAddress = tokenAddress

                // fetch requests using the resolved address
                const fetchedRequest = await requestsApi.search(requestParams)

                // if we have a request and the URL didn't specify an amount,
                // update the parsedPaymentData to include the amount from the request
                if (fetchedRequest && (!parsedPaymentData.amount || parsedPaymentData.amount === '')) {
                    dispatch(
                        paymentActions.setParsedPaymentData({
                            ...parsedPaymentData,
                            amount: fetchedRequest.tokenAmount ? formatAmount(fetchedRequest.tokenAmount) : undefined,
                        })
                    )
                }

                dispatch(paymentActions.setRequestDetails(fetchedRequest))
            } catch (_error) {
                setError(getDefaultError(!!user))
            }
        }
        if (!requestId) {
            fetchRequests()
        }
    }, [parsedPaymentData?.recipient, parsedPaymentData?.chain, parsedPaymentData?.token, parsedPaymentData?.amount])

    // fetch request details if request ID is available
    useEffect(() => {
        if (requestId) {
            requestsApi
                .get(requestId)
                .then((request) => {
                    dispatch(paymentActions.setRequestDetails(request))
                    dispatch(paymentActions.setView('INITIAL'))
                })
                .catch((_err) => {
                    setError(getDefaultError(!!user))
                })
        }
    }, [requestId])

    const handleSendClick = () => {
        setShowPaymentView(true)
        dispatch(paymentActions.setView('INITIAL'))
    }

    if (error) {
        return (
            <div className="mx-auto h-full w-full space-y-8 self-center md:w-6/12">
                <ValidationErrorView {...error} />
            </div>
        )
    }

    // show loading until URL is parsed and req/charge data is loaded
    const isLoading = !isUrlParsed || (chargeId && !chargeDetails) || (requestId && !requestDetails)
    if (isLoading) {
        return <PeanutLoading />
    }

    // check if its is a profile view
    if (
        isUrlParsed &&
        parsedPaymentData?.recipient?.recipientType === 'USERNAME' &&
        !parsedPaymentData.amount &&
        !chargeId &&
        !requestId &&
        !showPaymentView
    ) {
        const username = parsedPaymentData.recipient.identifier

        return (
            <PublicProfile
                username={username}
                fullName={username} // todo: replace with actual full name, getByUsername only returns username
                initials={username.substring(0, 2).toUpperCase()}
                isVerified={user?.user.kycStatus === 'approved'}
                isLoggedIn={!!user}
                // todo: to be implemented in history project
                transactions={{
                    sent: 0,
                    received: 0,
                }}
                onSendClick={handleSendClick}
            />
        )
    }

    if (parsedPaymentData?.token?.symbol === 'PNT') {
        return (
            <div className={twMerge('mx-auto h-full w-full space-y-8 self-center md:w-6/12')}>
                <div>
                    {currentView === 'INITIAL' && <InitialPaymentView {...parsedPaymentData} />}
                    {currentView === 'CONFIRM' && <ConfirmPaymentView />}
                    {currentView === 'STATUS' && <PintaReqPaySuccessView />}
                </div>
            </div>
        )
    }

    return (
        <div className={twMerge('mx-auto h-full w-full space-y-8 self-center md:w-6/12')}>
            <div>
                {currentView === 'INITIAL' && (
                    <div className="space-y-4">
                        <NavHeader
                            onPrev={() => {
                                setShowPaymentView(false)
                            }}
                        />
                        <InitialPaymentView {...(parsedPaymentData as ParsedURL)} />
                    </div>
                )}
                {currentView === 'CONFIRM' && <ConfirmPaymentView />}
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

const getDefaultError: (isUser: boolean) => ValidationErrorViewProps = (isUser) => ({
    title: 'Invalid Payment URL!',
    message: 'They payment you are trying to access is invalid. Please check the URL and try again.',
    buttonText: isUser ? 'Go to home' : 'Create your Peanut Wallet',
    redirectTo: isUser ? '/home' : '/setup',
})

function getErrorProps({ error, isUser }: { error: ParseUrlError; isUser: boolean }): ValidationErrorViewProps {
    switch (error.message) {
        case EParseUrlError.INVALID_RECIPIENT:
            return {
                title: 'Invalid Recipient',
                message: 'The recipient you are trying to pay is invalid. Please check the URL and try again.',
                buttonText: isUser ? 'Go to home' : 'Create your Peanut Wallet',
                redirectTo: isUser ? '/home' : '/setup',
            }
        case EParseUrlError.INVALID_CHAIN:
            return {
                title: 'Invalid Chain',
                message: 'You can pay the recipient in their preferred chain',
                buttonText: 'Pay them in their preferred chain',
                redirectTo: `/${error.recipient}`,
            }
        case EParseUrlError.INVALID_TOKEN:
            return {
                title: 'Invalid Token',
                message: 'You can pay the recipient in their preferred token',
                buttonText: 'Pay them in their preferred token',
                redirectTo: `/${error.recipient}`,
            }
        case EParseUrlError.INVALID_AMOUNT:
            return {
                title: 'Invalid Amount',
                message: 'Please check the url and try again',
                buttonText: isUser ? 'Go to home' : 'Create your Peanut Wallet',
                redirectTo: isUser ? '/home' : '/setup',
            }
        case EParseUrlError.INVALID_URL_FORMAT:
        default:
            return getDefaultError(isUser)
    }
}

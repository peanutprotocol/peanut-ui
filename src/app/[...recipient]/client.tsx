'use client'

import { StatusType } from '@/components/Global/Badges/StatusBadge'
import PeanutLoading from '@/components/Global/PeanutLoading'
import ConfirmPaymentView from '@/components/Payment/Views/Confirm.payment.view'
import ValidationErrorView, { ValidationErrorViewProps } from '@/components/Payment/Views/Error.validation.view'
import InitialPaymentView from '@/components/Payment/Views/Initial.payment.view'
import DirectSuccessView from '@/components/Payment/Views/Status.payment.view'
import PintaReqPaySuccessView from '@/components/PintaReqPay/Views/Success.pinta.view'
import PublicProfile from '@/components/Profile/components/PublicProfile'
import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useAuth } from '@/context/authContext'
import { useCurrency } from '@/hooks/useCurrency'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { EParseUrlError, parsePaymentURL, ParseUrlError } from '@/lib/url-parser/parser'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { formatAmount, getInitialsFromName } from '@/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { fetchTokenPrice } from '@/app/actions/tokens'

interface Props {
    recipient: string[]
    flow?: 'request_pay' | 'add_money' | 'direct_pay' | 'withdraw'
}

export default function PaymentPage({ recipient, flow = 'request_pay' }: Props) {
    const isDirectPay = flow === 'direct_pay'
    const isAddMoneyFlow = flow === 'add_money'
    const dispatch = useAppDispatch()
    const { currentView, parsedPaymentData, chargeDetails, paymentDetails, usdAmount } = usePaymentStore()
    const [error, setError] = useState<ValidationErrorViewProps | null>(null)
    const [isUrlParsed, setIsUrlParsed] = useState(false)
    const [isRequestDetailsFetching, setIsRequestDetailsFetching] = useState(false)
    const { user } = useAuth()
    const searchParams = useSearchParams()
    const chargeId = searchParams.get('chargeId')
    const requestId = searchParams.get('id')
    const router = useRouter()
    const {
        code: currencyCode,
        symbol: currencySymbol,
        price: currencyPrice,
    } = useCurrency(searchParams.get('currency'))
    const [currencyAmount, setCurrencyAmount] = useState<string>('')
    const { isDrawerOpen, selectedTransaction, openTransactionDetails } = useTransactionDetailsDrawer()

    const isMountedRef = useRef(true)

    // prevent memory leaks
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
        }
    }, [])

    useEffect(() => {
        if (!parsedPaymentData) {
            setIsUrlParsed(false)
            setError(null)
        }
    }, [parsedPaymentData])

    useEffect(() => {
        let isMounted = true
        const fetchParsedURL = async () => {
            const { parsedUrl, error } = await parsePaymentURL(recipient)

            if (!isMounted) return

            if (parsedUrl) {
                const amount = parsedUrl.amount ? formatAmount(parsedUrl.amount || '') : undefined
                const updatedParsedData = {
                    ...parsedUrl,
                    amount,
                }
                dispatch(paymentActions.setParsedPaymentData(updatedParsedData))
                setIsUrlParsed(true)

                // render PUBLIC_PROFILE view if applicable
                if (
                    updatedParsedData.recipient?.recipientType === 'USERNAME' &&
                    !updatedParsedData.amount &&
                    !chargeId &&
                    !requestId &&
                    !isDirectPay &&
                    !isAddMoneyFlow
                ) {
                    dispatch(paymentActions.setView('PUBLIC_PROFILE'))
                } else {
                    dispatch(paymentActions.setView('INITIAL'))
                }
            } else {
                setError(getErrorProps({ error, isUser: !!user }))
            }
        }

        if (!isUrlParsed) {
            fetchParsedURL()
        }

        return () => {
            isMounted = false
        }
    }, [recipient, user, isUrlParsed, dispatch, isDirectPay, chargeId, requestId])

    // handle validation and charge creation
    useEffect(() => {
        // always show initial view, to let payer select token/chain of choice
        if (chargeId) {
            chargesApi
                .get(chargeId)
                .then(async (charge) => {
                    dispatch(paymentActions.setChargeDetails(charge))

                    const isCurrencyValueReliable =
                        charge.currencyCode === 'USD' &&
                        charge.currencyAmount &&
                        String(charge.currencyAmount) !== String(charge.tokenAmount)

                    if (isCurrencyValueReliable) {
                        dispatch(paymentActions.setUsdAmount(Number(charge.currencyAmount).toFixed(2)))
                    } else {
                        const priceData = await fetchTokenPrice(charge.tokenAddress, charge.chainId)
                        if (priceData?.price) {
                            const usdValue = Number(charge.tokenAmount) * priceData.price
                            dispatch(paymentActions.setUsdAmount(usdValue.toFixed(2)))
                        }
                    }

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
    }, [chargeId, dispatch, user])

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
            setIsRequestDetailsFetching(true)
            requestsApi
                .get(requestId)
                .then((request) => {
                    if (!isMountedRef.current) return
                    dispatch(paymentActions.setRequestDetails(request))
                    dispatch(paymentActions.setView('INITIAL'))
                })
                .catch((_err) => {
                    if (!isMountedRef.current) return
                    setError(getDefaultError(!!user))
                })
                .finally(() => {
                    if (isMountedRef.current) {
                        setIsRequestDetailsFetching(false)
                    }
                })
        } else {
            setIsRequestDetailsFetching(false)
        }
    }, [requestId, dispatch, user])

    // reset payment state when navigating to a new payment page
    useEffect(() => {
        if (!chargeId) {
            dispatch(paymentActions.resetPaymentState())
            setIsUrlParsed(false)
        }
    }, [dispatch, chargeId])

    const transactionForDrawer: TransactionDetails | null = useMemo(() => {
        if (!chargeDetails) return null

        let status: StatusType
        switch (chargeDetails.timeline[0].status) {
            case 'NEW':
            case 'PENDING':
                status = 'pending'
                break
            case 'SIGNED':
                status = 'processing'
                break
            case 'COMPLETED':
            case 'SUCCESSFUL':
                status = 'completed'
                break
            case 'CANCELLED':
                status = 'cancelled'
                break
            case 'FAILED':
            case 'EXPIRED':
                status = 'failed'
                break
            default:
                status = 'pending'
                break
        }

        const recipientAccount = chargeDetails.requestLink.recipientAccount
        const isCurrentUser = recipientAccount?.userId === user?.user.userId
        if (status === 'pending' && !isCurrentUser) {
            return null
        }

        const username =
            recipientAccount?.user?.username ||
            recipientAccount?.identifier ||
            chargeDetails.requestLink.recipientAddress
        const originalUserRole = isCurrentUser ? EHistoryUserRole.RECIPIENT : EHistoryUserRole.SENDER
        let details: Partial<TransactionDetails> = {
            id: chargeDetails.uuid,
            status,
            amount: Number(chargeDetails.tokenAmount),
            date: new Date(paymentDetails?.createdAt ?? chargeDetails.createdAt),
            tokenSymbol: chargeDetails.tokenSymbol,
            initials: getInitialsFromName(username ?? ''),
            memo: chargeDetails.requestLink.reference ?? undefined,
            attachmentUrl: chargeDetails.requestLink.attachmentUrl ?? undefined,
            cancelledDate: status === 'cancelled' ? new Date(chargeDetails.timeline[0].time) : undefined,
            extraDataForDrawer: {
                isLinkTransaction: originalUserRole === EHistoryUserRole.SENDER && isCurrentUser,
                originalType: EHistoryEntryType.REQUEST,
                originalUserRole: originalUserRole,
                link: window.location.href,
            },
            userName: username ?? chargeDetails.requestLink.recipientAddress,
            sourceView: 'history',
            peanutFeeDetails: {
                amountDisplay: '$ 0.00',
            },
            currency: usdAmount ? { amount: usdAmount, code: 'USD' } : undefined,
        }

        if (isAddMoneyFlow) {
            details.extraDataForDrawer = {
                isLinkTransaction: false,
                originalType: EHistoryEntryType.DEPOSIT,
                originalUserRole: EHistoryUserRole.SENDER,
            }
            details.direction = 'add'
            details.userName = user?.user.username ?? undefined
            details.initials = getInitialsFromName(user?.user.fullName ?? user?.user?.username ?? 'PU')
        }

        return details as TransactionDetails
    }, [chargeDetails, user?.user.userId, isAddMoneyFlow, user?.user.username, usdAmount, paymentDetails])

    useEffect(() => {
        if (!transactionForDrawer) return

        // if add money flow and in initial or confirm view, don't auto set status
        if (isAddMoneyFlow && (currentView === 'INITIAL' || currentView === 'CONFIRM') && !chargeId) {
            return
        }

        dispatch(paymentActions.setView('STATUS'))

        // only open transaction details drawer if not add money flow
        if (!isAddMoneyFlow) {
            openTransactionDetails(transactionForDrawer)
        }
    }, [transactionForDrawer, currentView, dispatch, openTransactionDetails, isAddMoneyFlow, chargeId])

    if (error) {
        return (
            <div className="mx-auto h-full w-full space-y-8 self-center md:w-6/12">
                <ValidationErrorView {...error} />
            </div>
        )
    }

    // show loading until URL is parsed and req/charge data is loaded
    const isLoading = !isUrlParsed || (chargeId && !chargeDetails) || isRequestDetailsFetching

    if (isLoading) {
        return (
            <div className="flex min-h-[calc(100dvh-180px)] w-full items-center justify-center ">
                <PeanutLoading />
            </div>
        )
    }

    // render PUBLIC_PROFILE view
    if (
        currentView === 'PUBLIC_PROFILE' &&
        parsedPaymentData?.recipient?.recipientType === 'USERNAME' &&
        !isAddMoneyFlow
    ) {
        const username = parsedPaymentData.recipient.identifier
        const handleSendClick = () => {
            router.push(`/send/${username}`)
        }
        return (
            <div className={twMerge('mx-auto h-full min-h-[inherit] w-full space-y-8 self-start')}>
                <PublicProfile
                    username={username}
                    isVerified={user?.user.kycStatus === 'approved'}
                    isLoggedIn={!!user}
                    onSendClick={handleSendClick}
                />
            </div>
        )
    }

    // pinta token payment flow
    if (parsedPaymentData?.token?.symbol === 'PNT') {
        return (
            <div className={twMerge('mx-auto h-full w-full space-y-8 self-center')}>
                <div>
                    {currentView === 'INITIAL' && <InitialPaymentView {...parsedPaymentData} isPintaReq={true} />}
                    {currentView === 'CONFIRM' && <ConfirmPaymentView isPintaReq={true} />}
                    {currentView === 'STATUS' && <PintaReqPaySuccessView />}
                </div>
            </div>
        )
    }

    // default payment flow
    return (
        <div className={twMerge('mx-auto h-full min-h-[inherit] w-full space-y-8 self-center')}>
            {currentView === 'INITIAL' && (
                <InitialPaymentView
                    {...(parsedPaymentData as ParsedURL)}
                    isAddMoneyFlow={isAddMoneyFlow}
                    isDirectPay={isDirectPay}
                    currency={
                        currencyCode
                            ? {
                                  code: currencyCode,
                                  symbol: currencySymbol!,
                                  price: currencyPrice!,
                              }
                            : undefined
                    }
                    setCurrencyAmount={(value: string | undefined) => setCurrencyAmount(value || '')}
                    currencyAmount={currencyAmount}
                />
            )}
            {currentView === 'CONFIRM' && (
                <ConfirmPaymentView
                    isPintaReq={parsedPaymentData?.token?.symbol === 'PNT'}
                    currencyAmount={currencyCode && currencyAmount ? `${currencySymbol} ${currencyAmount}` : undefined}
                    isAddMoneyFlow={isAddMoneyFlow}
                    isDirectPay={isDirectPay}
                />
            )}
            {currentView === 'STATUS' && (
                <>
                    {parsedPaymentData?.token?.symbol === 'PNT' ? (
                        <PintaReqPaySuccessView />
                    ) : isDrawerOpen && selectedTransaction?.id === transactionForDrawer?.id ? (
                        <TransactionDetailsReceipt transaction={selectedTransaction} />
                    ) : (
                        <DirectSuccessView
                            headerTitle={isAddMoneyFlow ? 'Add Money' : 'Send'}
                            recipientType={parsedPaymentData?.recipient?.recipientType}
                            type="SEND"
                            currencyAmount={
                                currencyCode && currencyAmount ? `${currencySymbol} ${currencyAmount}` : undefined
                            }
                            isAddMoneyFlow={isAddMoneyFlow}
                            redirectTo={isAddMoneyFlow ? '/add-money' : '/send'}
                        />
                    )}
                </>
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

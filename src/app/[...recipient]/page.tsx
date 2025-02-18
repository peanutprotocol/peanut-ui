'use client'

import PeanutLoading from '@/components/Global/PeanutLoading'
import PaymentHistory from '@/components/Payment/History'
import ChargeStatusView from '@/components/Payment/Views/Charge.status.view'
import ConfirmPaymentView from '@/components/Payment/Views/Confirm.payment.view'
import InitialPaymentView from '@/components/Payment/Views/Initial.payment.view'
import RequestStatusView from '@/components/Payment/Views/Request.status.view'
import { JUSTANAME_ENS, supportedPeanutChains } from '@/constants'
import { SUPPORTED_TOKENS } from '@/lib/url-parser/constants/tokens'
import { parsePaymentURL } from '@/lib/url-parser/parser'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { normalizeChainName, resolveChainId } from '@/lib/validation/resolvers/chain-resolver'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { resolveFromEnsName } from '@/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { isAddress } from 'viem'

export default function PaymentPage({ params }: { params: { recipient: string[] } }) {
    const dispatch = useAppDispatch()
    const { currentView, attachmentOptions, resolvedAddress, requestDetails } = usePaymentStore()
    const [error, setError] = useState<Error | null>(null)
    const [isLoadingCharge, setIsLoadingCharge] = useState(true)
    const [isLoadingRequests, setIsLoadingRequests] = useState(true)
    const searchParams = useSearchParams()
    const router = useRouter()
    const chargeId = searchParams.get('chargeId')
    const requestId = searchParams.get('id')

    // avoid re-parsing the URL on every render
    const parsedURL = useMemo(() => {
        try {
            const parsed = parsePaymentURL(params.recipient)

            // if chain is specified but token not, set USDC as default
            if (parsed.chain && !parsed.token) {
                const chainId =
                    typeof parsed.chain === 'number'
                        ? parsed.chain
                        : supportedPeanutChains.find(
                              (c) =>
                                  normalizeChainName(c.name.toLowerCase()) ===
                                  normalizeChainName(parsed.chain as string)
                          )?.chainId

                if (chainId && SUPPORTED_TOKENS.USDC.addresses[Number(chainId)]) {
                    parsed.token = 'USDC'
                }
            }

            dispatch(paymentActions.setUrlParams(parsed))
            return parsed
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to parse URL'))
            return null
        }
    }, [params.recipient, dispatch])

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
                            dispatch(paymentActions.setView('SUCCESS'))
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
            if (!parsedURL?.recipient) return

            setIsLoadingRequests(true)
            try {
                let recipientAddress: string | null = null

                // resolve the recipient if its not an address
                if (!isAddress(parsedURL.recipient)) {
                    try {
                        let nameToResolve = parsedURL.recipient

                        // remove chain part if present (after @)
                        if (nameToResolve.includes('@')) {
                            nameToResolve = nameToResolve.split('@')[0]
                        }

                        // if username has no dots, treat as native peanut username
                        if (!nameToResolve.includes('.')) {
                            nameToResolve = `${nameToResolve}.${JUSTANAME_ENS}`
                        }

                        const resolved = await resolveFromEnsName(nameToResolve)
                        if (!resolved) {
                            throw new Error('Could not resolve recipient name')
                        }
                        recipientAddress = resolved
                        // store resolved address in redux
                        dispatch(paymentActions.setResolvedAddress(resolved))
                    } catch (error) {
                        console.error('Failed to resolve recipient:', error)
                        setError(new Error('Invalid recipient name'))
                        return
                    }
                } else {
                    recipientAddress = parsedURL.recipient
                }

                if (!recipientAddress) {
                    throw new Error('No valid recipient address')
                }

                const tokenAddress =
                    parsedURL.token &&
                    parsedURL.chain &&
                    SUPPORTED_TOKENS[parsedURL.token.toUpperCase()]?.addresses[Number(parsedURL.chain)]

                const chainId = parsedURL?.chain
                    ? typeof parsedURL.chain === 'number'
                        ? parsedURL.chain
                        : resolveChainId(parsedURL.chain)
                    : undefined

                //  conditional request params
                const requestParams: any = { recipient: recipientAddress }
                if (parsedURL.amount) requestParams.tokenAmount = parsedURL.amount
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
    }, [parsedURL?.recipient, parsedURL?.chain, parsedURL?.token, parsedURL?.amount, dispatch])

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
                        dispatch(paymentActions.setView('SUCCESS'))
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
        return <div>Error: {error.message}</div>
    }

    if (isLoadingCharge || (chargeId && !currentView)) {
        return <PeanutLoading />
    }

    if (isLoadingRequests && !chargeId) {
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
                {currentView === 'INITIAL' && <InitialPaymentView {...(parsedURL as ParsedURL)} />}
                {currentView === 'CONFIRM' && (
                    <div className="self-start">
                        <ConfirmPaymentView />
                    </div>
                )}
                {currentView === 'SUCCESS' && (requestId ? <RequestStatusView /> : <ChargeStatusView />)}
            </div>
            {currentView === 'INITIAL' && (
                <div>
                    <PaymentHistory history={requestDetails?.history || []} recipient={parsedURL?.recipient || ''} />
                </div>
            )}
        </div>
    )
}

'use client'

import PeanutLoading from '@/components/Global/PeanutLoading'
import PaymentHistory from '@/components/Payment/History'
import ConfirmPaymentView from '@/components/Payment/Views/Confirm.payment.view'
import InitialPaymentView from '@/components/Payment/Views/Initial.payment.view'
import SuccessPaymentView from '@/components/Payment/Views/Success.payment.view'
import { supportedPeanutChains } from '@/constants'
import { SUPPORTED_TOKENS } from '@/lib/url-parser/constants/tokens'
import { parsePaymentURL } from '@/lib/url-parser/parser'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { normalizeChainName } from '@/lib/validation/resolvers/chain-resolver'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { resolveFromEnsName } from '@/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { isAddress } from 'viem'

export default function PaymentPage({ params }: { params: { recipient: string[] } }) {
    const dispatch = useAppDispatch()
    const { currentView, attachmentOptions, resolvedAddress } = usePaymentStore()
    const [error, setError] = useState<Error | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const searchParams = useSearchParams()
    const router = useRouter()
    const chargeId = searchParams.get('chargeId')

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
        if (!parsedURL) return

        async function initializePayment() {
            try {
                if (!parsedURL) return

                // if chargeId exists, fetch existing charge
                if (chargeId) {
                    try {
                        const charge = await chargesApi.get(chargeId)

                        if (charge) {
                            dispatch(paymentActions.setChargeDetails(charge))
                            dispatch(paymentActions.setView('CONFIRM'))
                        }

                        setIsLoading(false)
                    } catch (error) {
                        console.error('Failed to fetch charge:', error)
                        setError(new Error('Failed to fetch charge details'))
                        setIsLoading(false)
                    }
                    return
                }

                // show payment form with pre-filled values from URL
                setIsLoading(false)
                dispatch(paymentActions.setView('INITIAL'))
            } catch (err) {
                setError(err instanceof Error ? err : new Error('Failed to initialize payment'))
                setIsLoading(false)
            }
        }

        initializePayment()
    }, [parsedURL, chargeId, dispatch, router, attachmentOptions])

    // fetch requests for the recipient
    useEffect(() => {
        async function fetchRequests() {
            if (!parsedURL?.recipient) return

            setIsLoading(true)
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
                            // todo: move to env
                            nameToResolve = `${nameToResolve}.testvc.eth`
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

                // fetch requests using the resolved address
                const fetchedRequest = await requestsApi.search({
                    recipient: recipientAddress,
                    // todo: add other filters here
                })

                dispatch(paymentActions.setRequestDetails(fetchedRequest))
            } catch (error) {
                console.error('Failed to fetch requests:', error)
                setError(error instanceof Error ? error : new Error('Failed to fetch requests'))
            } finally {
                setIsLoading(false)
            }
        }

        fetchRequests()
    }, [parsedURL?.recipient, parsedURL?.chain, parsedURL?.token, parsedURL?.amount, dispatch])

    if (error) {
        return <div>Error: {error.message}</div>
    }

    if (isLoading || !parsedURL) {
        return <PeanutLoading />
    }

    return (
        <div className="mx-auto w-full space-y-8 md:w-6/12">
            <div>
                {currentView === 'INITIAL' && <InitialPaymentView {...(parsedURL as ParsedURL)} />}
                {currentView === 'CONFIRM' && (
                    <div className="self-start">
                        <ConfirmPaymentView />
                    </div>
                )}
                {currentView === 'SUCCESS' && <SuccessPaymentView />}
            </div>
            {currentView === 'INITIAL' && (
                <div>
                    <PaymentHistory recipient={parsedURL?.recipient} />
                </div>
            )}
        </div>
    )
}

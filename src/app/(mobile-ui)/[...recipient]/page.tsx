'use client'

import PaymentHistory from '@/components/Payment/History'
import ConfirmPaymentView from '@/components/Payment/Views/Confirm.payment.view'
import InitialPaymentView from '@/components/Payment/Views/Initial.payment.view'
import SuccessPaymentView from '@/components/Payment/Views/Success.payment.view'
import { supportedPeanutChains } from '@/constants'
import { SUPPORTED_TOKENS } from '@/lib/url-parser/constants/tokens'
import { parsePaymentURL } from '@/lib/url-parser/parser'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { normalizeChainName } from '@/lib/validation/chain-resolver'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { Payment, RequestCharge } from '@/services/services.types'
import { resolveRecipientToAddress } from '@/utils/recipient-resolver'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

// todo: move this to a utils file
function getTokenAddressForChain(tokenSymbol: string, chainId: string | number): string {
    const token = SUPPORTED_TOKENS[tokenSymbol.toUpperCase()]

    if (!token) {
        throw new Error(`Unsupported token: ${tokenSymbol}`)
    }

    // Convert chain name to chain ID if needed
    let resolvedChainId: number
    if (typeof chainId === 'string' && isNaN(Number(chainId))) {
        // resolve chain name to chain id
        const normalizedChainName = normalizeChainName(chainId)
        const matchedChain = supportedPeanutChains.find(
            (c) => normalizeChainName(c.name.toLowerCase()) === normalizedChainName
        )
        if (!matchedChain) {
            throw new Error(`Unsupported chain: ${chainId}`)
        }
        resolvedChainId = Number(matchedChain.chainId)
    } else {
        resolvedChainId = Number(chainId)
    }

    const address = token.addresses[resolvedChainId]

    if (!address) {
        throw new Error(`Token ${tokenSymbol} not available on chain ${chainId}`)
    }

    return address
}

export default function PaymentPage({ params }: { params: { recipient: string[] } }) {
    const dispatch = useAppDispatch()
    const { currentView, attachmentOptions } = usePaymentStore()
    const [error, setError] = useState<Error | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const searchParams = useSearchParams()
    const router = useRouter()
    const chargeId = searchParams.get('chargeId')
    const [charge, setCharge] = useState<RequestCharge | null>(null)

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
                // if chargeId exists, fetch existing charge
                if (chargeId) {
                    try {
                        const charge = await chargesApi.get(chargeId)

                        // check if theres an existing active payment
                        const hasActivePayment = charge.payments.some(
                            (payment: Payment) => !['NEW', 'FAILED'].includes(payment.status)
                        )

                        if (hasActivePayment) {
                            // show timeline view for active payments
                            setCharge(charge)
                            dispatch(paymentActions.setRequestDetails(charge))
                            // todo: rethink approach
                            // dispatch(paymentActions.setView(4))
                        } else {
                            // show confirm view for new/failed payments
                            setCharge(charge)
                            dispatch(paymentActions.setRequestDetails(charge))
                            dispatch(paymentActions.setView(2))
                        }
                        setIsLoading(false)
                    } catch (error) {
                        console.error('Failed to fetch charge:', error)
                        setError(new Error('Failed to fetch charge details'))
                        setIsLoading(false)
                    }
                    return
                }

                // check if all required parameters are present
                const hasAllParams =
                    parsedURL && parsedURL.recipient && parsedURL.amount && parsedURL.token && parsedURL.chain

                if (hasAllParams) {
                    // create request and charge directly
                    await createRequestAndCharge(parsedURL as ParsedURL)
                } else {
                    // show initial view with form
                    setIsLoading(false)
                    dispatch(paymentActions.setView(1))
                }
            } catch (err) {
                setError(err instanceof Error ? err : new Error('Failed to initialize payment'))
                setIsLoading(false)
            }
        }

        // helper function to create request and charge
        async function createRequestAndCharge(params: ParsedURL) {
            try {
                const resolvedAddress = await resolveRecipientToAddress(params.recipient)

                // get token address for the chain
                const tokenAddress = getTokenAddressForChain(params.token ?? '', params.chain ?? '')

                // create request
                const request = await requestsApi.create({
                    chainId: params?.chain?.toString() ?? '',
                    tokenAmount: params.amount,
                    recipientAddress: resolvedAddress,
                    tokenType: 'erc20',
                    tokenAddress: tokenAddress,
                    tokenDecimals: '18',
                    tokenSymbol: params?.token ?? '',
                    reference: attachmentOptions?.message,
                    attachment: attachmentOptions?.rawFile,
                })

                // create charge
                const charge = await chargesApi.create({
                    pricing_type: 'fixed_price',
                    local_price: {
                        amount: params?.amount ?? '',
                        currency: 'USD',
                    },
                    baseUrl: window.location.origin,
                    requestId: request.id,
                    requestProps: {
                        chainId: params?.chain?.toString() ?? '',
                        tokenAddress: tokenAddress,
                        tokenType: 'erc20',
                        tokenSymbol: params?.token ?? '',
                        tokenDecimals: 18,
                        recipientAddress: resolvedAddress,
                    },
                })

                // update URL and redirect to confirmation view
                router.push(`${window.location.pathname}?chargeId=${charge.data.id}`)
                dispatch(paymentActions.setRequestDetails({ ...charge.data, request }))
                dispatch(paymentActions.setView(2))
            } catch (error) {
                console.error('Failed to create request/charge:', error)
                throw error
            }
        }

        initializePayment()
    }, [parsedURL, chargeId, dispatch, router, attachmentOptions])

    if (error) {
        return <div>Error: {error.message}</div>
    }

    if (isLoading || !parsedURL) {
        return <div>Loading...</div>
    }

    return (
        <div className="mx-auto w-full space-y-8 md:w-6/12">
            <div>
                {currentView === 1 && <InitialPaymentView {...(parsedURL as ParsedURL)} />}
                {currentView === 2 && <ConfirmPaymentView />}
                {currentView === 3 && <SuccessPaymentView />}
                {/* todo: add timeline view? */}
                {/* {currentView === 4 && charge && <PaymentTimeline charge={charge} />} */}
            </div>
            <div>
                <PaymentHistory recipient={parsedURL?.recipient} />
            </div>
        </div>
    )
}

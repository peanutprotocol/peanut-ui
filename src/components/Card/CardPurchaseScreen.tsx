'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import { Icon } from '@/components/Global/Icons/Icon'
import Card from '@/components/Global/Card'
import { cardApi, CardPurchaseError } from '@/services/card'
import Loading from '@/components/Global/Loading'

interface CardPurchaseScreenProps {
    price: number
    existingChargeUuid?: string | null
    existingPaymentUrl?: string | null
    onPurchaseInitiated: (chargeUuid: string, paymentUrl: string) => void
    onPurchaseComplete: () => void
    onBack: () => void
}

type PurchaseState = 'idle' | 'creating' | 'awaiting_payment' | 'error'

const CardPurchaseScreen = ({
    price,
    existingChargeUuid,
    existingPaymentUrl,
    onPurchaseInitiated,
    onPurchaseComplete,
    onBack,
}: CardPurchaseScreenProps) => {
    const [purchaseState, setPurchaseState] = useState<PurchaseState>(existingChargeUuid ? 'awaiting_payment' : 'idle')
    const [chargeUuid, setChargeUuid] = useState<string | null>(existingChargeUuid || null)
    const [paymentUrl, setPaymentUrl] = useState<string | null>(existingPaymentUrl || null)
    const [error, setError] = useState<string | null>(null)

    // Guard against double-submit race condition (React state updates are async,
    // so rapid clicks could trigger multiple API calls before state updates)
    const isInitiatingRef = useRef(false)

    // Initialize purchase with debounce guard
    const initiatePurchase = useCallback(async () => {
        if (isInitiatingRef.current) return
        isInitiatingRef.current = true

        setPurchaseState('creating')
        setError(null)

        try {
            const response = await cardApi.purchase()
            setChargeUuid(response.chargeUuid)
            setPaymentUrl(response.paymentUrl)
            onPurchaseInitiated(response.chargeUuid, response.paymentUrl)
            setPurchaseState('awaiting_payment')
        } catch (err) {
            if (err instanceof CardPurchaseError) {
                if (err.code === 'ALREADY_PURCHASED') {
                    // User already purchased, redirect to success
                    onPurchaseComplete()
                    return
                }
                setError(err.message)
            } else {
                setError('Failed to initiate purchase. Please try again.')
            }
            setPurchaseState('error')
        } finally {
            isInitiatingRef.current = false
        }
    }, [onPurchaseInitiated, onPurchaseComplete])

    // Open payment URL in new tab
    const openPaymentUrl = useCallback(() => {
        if (paymentUrl) {
            window.open(paymentUrl, '_blank', 'noopener,noreferrer')
        }
    }, [paymentUrl])

    // Poll for payment completion with timeout
    useEffect(() => {
        if (purchaseState !== 'awaiting_payment' || !chargeUuid) return

        let attempts = 0
        const maxAttempts = 40 // 40 attempts * 3s = 2 minutes max

        const pollInterval = setInterval(async () => {
            attempts++

            // Check for timeout
            if (attempts > maxAttempts) {
                clearInterval(pollInterval)
                setError('Payment verification timed out. Please check your transaction status.')
                setPurchaseState('error')
                return
            }

            try {
                const info = await cardApi.getInfo()
                if (info.hasPurchased) {
                    clearInterval(pollInterval)
                    onPurchaseComplete()
                }
            } catch {
                // Ignore polling errors - will retry on next interval
            }
        }, 3000)

        return () => clearInterval(pollInterval)
    }, [purchaseState, chargeUuid, onPurchaseComplete])

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Complete Purchase" onPrev={onBack} />

            <div className="my-auto flex flex-col gap-6">
                {purchaseState === 'idle' && (
                    <>
                        <Card className="flex flex-col items-center gap-4 p-6">
                            <div className="flex size-16 items-center justify-center rounded-full bg-purple-1">
                                <Icon name="wallet" size={32} />
                            </div>
                            <div className="text-center">
                                <h2 className="text-xl font-bold">Confirm Purchase</h2>
                                <p className="mt-2 text-sm text-black">
                                    You're about to reserve your Card Pioneer spot for ${price}. This amount will become
                                    your starter balance when the card launches.
                                </p>
                            </div>
                        </Card>

                        {/* Price Summary */}
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-black">Pioneer Reservation</span>
                                <span className="text-xl font-bold">${price}</span>
                            </div>
                        </Card>
                    </>
                )}

                {purchaseState === 'creating' && (
                    <Card className="flex flex-col items-center gap-4 p-6">
                        <Loading className="size-12" />
                        <div className="text-center">
                            <h2 className="text-xl font-bold">Creating Payment...</h2>
                            <p className="mt-2 text-sm text-black">Setting up your purchase. Please wait.</p>
                        </div>
                    </Card>
                )}

                {purchaseState === 'awaiting_payment' && (
                    <>
                        <Card className="flex flex-col items-center gap-4 p-6">
                            <div className="flex size-16 items-center justify-center rounded-full bg-yellow-1">
                                <Icon name="clock" size={32} />
                            </div>
                            <div className="text-center">
                                <h2 className="text-xl font-bold">Complete Payment</h2>
                                <p className="mt-2 text-sm text-black">
                                    Click below to open the payment page and complete your Pioneer reservation.
                                </p>
                            </div>
                        </Card>

                        <Button
                            variant="stroke"
                            size="large"
                            icon="external-link"
                            onClick={openPaymentUrl}
                            className="w-full"
                        >
                            Open Payment Page
                        </Button>

                        <div className="flex items-center justify-center gap-2 text-sm text-black">
                            <Loading className="size-4" />
                            <span>Waiting for payment confirmation...</span>
                        </div>
                    </>
                )}

                {purchaseState === 'error' && (
                    <Card className="flex flex-col items-center gap-4 p-6">
                        <div className="flex size-16 items-center justify-center rounded-full bg-error-1">
                            <Icon name="cancel" size={32} />
                        </div>
                        <div className="text-center">
                            <h2 className="text-xl font-bold">Something Went Wrong</h2>
                            <p className="mt-2 text-sm text-black">
                                {error || 'An error occurred while processing your purchase.'}
                            </p>
                        </div>
                    </Card>
                )}

                {/* CTA Buttons */}
                {purchaseState === 'idle' && (
                    <Button variant="purple" shadowSize="4" onClick={initiatePurchase} className="w-full">
                        Pay ${price}
                    </Button>
                )}

                {purchaseState === 'error' && (
                    <div className="space-y-3">
                        <Button variant="purple" shadowSize="4" onClick={initiatePurchase} className="w-full">
                            Try Again
                        </Button>
                        <Button variant="stroke" onClick={onBack} className="w-full">
                            Go Back
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default CardPurchaseScreen

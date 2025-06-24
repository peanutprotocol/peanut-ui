'use client'

import { Button } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import { useAddFlow } from '@/context/AddFlowContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface IOnrampData {
    transferId?: string
    depositInstructions?: {
        amount?: string
        currency?: string
        depositMessage?: string
        bankName?: string
        bankAddress?: string
        bankRoutingNumber?: string
        bankAccountNumber?: string
        bankBeneficiaryName?: string
        bankBeneficiaryAddress?: string
    }
}

export default function AddMoneyBankPage() {
    const { amountToAdd, setFromBankSelected, setAmountToAdd } = useAddFlow()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [onrampData, setOnrampData] = useState<IOnrampData | null>(null)

    useEffect(() => {
        // If no amount is set, redirect back to add money page
        if (!amountToAdd || parseFloat(amountToAdd) <= 0) {
            router.replace('/add-money')
            return
        }

        // Load onramp data from sessionStorage
        const storedData = sessionStorage.getItem('onrampData')
        if (storedData) {
            try {
                const parsedData = JSON.parse(storedData)
                setOnrampData(parsedData)
            } catch (error) {
                console.error('Error parsing onramp data:', error)
            }
        }
    }, [amountToAdd, router])

    const handleContinue = async () => {
        setIsLoading(true)

        // Clean up onramp data from storage
        sessionStorage.removeItem('onrampData')

        // Simulate processing delay
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // For now, show success message since actual bank integration isn't implemented
        alert(
            `Bank transfer setup for $${amountToAdd} completed. Please use the bank details provided to make your transfer.`
        )

        // Reset flow and go back to home
        setFromBankSelected(false)
        setAmountToAdd('')
        setIsLoading(false)
        router.push('/home')
    }

    const handleBack = () => {
        router.back()
    }

    if (!amountToAdd) {
        return null
    }

    return (
        <div className="flex h-full w-full flex-col justify-start gap-8 self-start">
            <NavHeader title="Add Money" onPrev={handleBack} />

            <div className="my-auto flex h-full w-full flex-col justify-center space-y-4 pb-5">
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType={'ADD_MONEY'}
                    recipientType={'BANK_ACCOUNT'}
                    recipientName={'Your Bank Account'}
                    amount={amountToAdd}
                    tokenSymbol={PEANUT_WALLET_TOKEN_SYMBOL}
                />

                <Card className="rounded-sm">
                    <PaymentInfoRow label={'Amount'} value={`$${amountToAdd}`} />
                    <PaymentInfoRow
                        label={'Bank Name'}
                        value={onrampData?.depositInstructions?.bankName || 'Loading...'}
                    />
                    <PaymentInfoRow
                        label={'Bank Address'}
                        value={onrampData?.depositInstructions?.bankAddress || 'Loading...'}
                    />
                    <PaymentInfoRow
                        label={'Account Number'}
                        value={onrampData?.depositInstructions?.bankAccountNumber || 'Loading...'}
                    />
                    <PaymentInfoRow
                        label={'Routing Number'}
                        value={onrampData?.depositInstructions?.bankRoutingNumber || 'Loading...'}
                    />
                    <PaymentInfoRow
                        hideBottomBorder
                        label={'Deposit Message'}
                        value={onrampData?.depositInstructions?.depositMessage || 'Loading...'}
                    />
                </Card>

                <div className="space-y-2 rounded-sm bg-blue-50 p-4">
                    <h3 className="font-semibold text-blue-900">Next Steps:</h3>
                    <ul className="space-y-1 text-sm text-blue-800">
                        <li>• Complete identity verification (KYC)</li>
                        <li>• Link your bank account securely</li>
                        <li>• Confirm transfer details</li>
                        <li>• Funds will arrive in 1-3 business days</li>
                    </ul>
                </div>

                <Button
                    icon="arrow-up"
                    loading={isLoading}
                    iconSize={12}
                    shadowSize="4"
                    onClick={handleContinue}
                    disabled={isLoading}
                    className="w-full"
                >
                    {isLoading ? 'Processing...' : 'Continue Setup'}
                </Button>
            </div>
        </div>
    )
}

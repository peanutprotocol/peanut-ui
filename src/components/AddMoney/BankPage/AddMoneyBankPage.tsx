'use client'

import { Button } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import ShareButton from '@/components/Global/ShareButton'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import { useAddFlow } from '@/context/AddFlowContext'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { countryData } from '@/components/AddMoney/consts'
import { getCurrencySymbol, formatCurrencyAmount } from '@/utils/currency.utils'

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
        iban?: string
        bic?: string
    }
}

export default function AddMoneyBankPage() {
    const { amountToAdd, setFromBankSelected, setAmountToAdd } = useAddFlow()
    const router = useRouter()
    const params = useParams()
    const [onrampData, setOnrampData] = useState<IOnrampData | null>(null)

    // Get country information from URL params
    const currentCountry = useMemo(() => {
        // Check if we have country params (from dynamic route)
        if (params.country) {
            const countryPathParts = Array.isArray(params.country) ? params.country : [params.country]
            const countryPath = countryPathParts.slice(0, -1).join('-') // Remove 'bank' from the end
            return countryData.find((country) => country.type === 'country' && country.path === countryPath)
        }

        // Check if we're on the static US route by examining the current pathname
        if (typeof window !== 'undefined' && window.location.pathname.includes('/add-money/us/bank')) {
            return countryData.find((c) => c.id === 'US')
        }

        // Default to US if no country is detected
        return countryData.find((c) => c.id === 'US')
    }, [params.country])

    const currencySymbol = useMemo(() => {
        return getCurrencySymbol(currentCountry?.currency || 'USD')
    }, [currentCountry])

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

    const generateBankDetails = async () => {
        const formattedAmount = formatCurrencyAmount(amountToAdd, currentCountry?.currency || 'USD')
        const bankDetails = `Bank Transfer Details:
Amount: ${formattedAmount}
Bank Name: ${onrampData?.depositInstructions?.bankName || 'Loading...'}
Bank Address: ${onrampData?.depositInstructions?.bankAddress || 'Loading...'}
Account Number: ${onrampData?.depositInstructions?.bankAccountNumber || 'Loading...'}
Routing Number: ${onrampData?.depositInstructions?.bankRoutingNumber || 'Loading...'}
Deposit Message: ${onrampData?.depositInstructions?.depositMessage || 'Loading...'}

Please use these details to complete your bank transfer.`

        return bankDetails
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
                    <PaymentInfoRow
                        label={'Amount'}
                        value={formatCurrencyAmount(amountToAdd, currentCountry?.currency || 'USD')}
                    />
                    <PaymentInfoRow
                        label={'Bank Name'}
                        value={onrampData?.depositInstructions?.bankName || 'Loading...'}
                    />
                    <PaymentInfoRow
                        label={'Bank Address'}
                        value={onrampData?.depositInstructions?.bankAddress || 'Loading...'}
                    />
                    <PaymentInfoRow
                        label={onrampData?.depositInstructions?.bankAccountNumber ? 'Account Number' : 'IBAN'}
                        value={
                            onrampData?.depositInstructions?.bankAccountNumber ||
                            onrampData?.depositInstructions?.iban ||
                            'Loading...'
                        }
                    />
                    <PaymentInfoRow
                        label={onrampData?.depositInstructions?.bankRoutingNumber ? 'Routing Number' : 'BIC'}
                        value={
                            onrampData?.depositInstructions?.bankRoutingNumber ||
                            onrampData?.depositInstructions?.bic ||
                            'Loading...'
                        }
                    />
                    <PaymentInfoRow
                        hideBottomBorder
                        label={'Deposit Message'}
                        value={onrampData?.depositInstructions?.depositMessage || 'Loading...'}
                        moreInfoText="Make sure you enter this exact message as the transfer concept or description. If it's not included, the deposit can't be processed."
                    />
                </Card>

                {/* <div className="space-y-2 rounded-sm bg-blue-50 p-4">
                    <h3 className="font-semibold text-blue-900">Next Steps:</h3>
                    <ul className="space-y-1 text-sm text-blue-800">
                        <li>• Complete identity verification (KYC)</li>
                        <li>• Link your bank account securely</li>
                        <li>• Confirm transfer details</li>
                        <li>• Funds will arrive in 1-3 business days</li>
                    </ul>
                </div> */}

                <ShareButton
                    generateText={generateBankDetails}
                    title="Bank Transfer Details"
                    variant="purple"
                    className="w-full"
                >
                    Share Details
                </ShareButton>
            </div>
        </div>
    )
}

'use client'

import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import ShareButton from '@/components/Global/ShareButton'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { countryCodeMap, countryData } from '@/components/AddMoney/consts'
import { formatCurrencyAmount } from '@/utils/currency'
import Icon from '@/components/Global/Icon'

export interface IOnrampData {
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

export default function AddMoneyBankDetails() {
    const { amountToOnramp } = useOnrampFlow()
    const router = useRouter()
    const params = useParams()
    const currentCountryName = params.country as string
    const [onrampData, setOnrampData] = useState<IOnrampData | null>(null)

    // Get country information from URL params
    const currentCountryDetails = useMemo(() => {
        // Check if we have country params (from dynamic route)
        if (currentCountryName) {
            const countryDetails = countryData.find(
                (country) => country.type === 'country' && country.path === currentCountryName.toLowerCase()
            )
            return countryDetails
        }

        // Check if we're on the static US route by examining the current pathname
        if (typeof window !== 'undefined' && window.location.pathname.includes('/add-money/us/bank')) {
            return countryData.find((c) => c.id === 'US')
        }

        // Default to US if no country is detected
        return countryData.find((c) => c.id === 'US')
    }, [currentCountryName])

    const countryCodeForFlag = useMemo(() => {
        const countryId = currentCountryDetails?.id || 'USA'
        const countryCode = countryCodeMap[countryId]
        return countryCode?.toLowerCase() || 'us'
    }, [currentCountryDetails])

    useEffect(() => {
        // If no amount is set, redirect back to add money page
        if (!amountToOnramp || parseFloat(amountToOnramp) <= 0) {
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
    }, [amountToOnramp, router])

    const generateBankDetails = async () => {
        const formattedAmount = formatCurrencyAmount(amountToOnramp, currentCountryDetails?.currency || 'USD')
        const isMexico = currentCountryDetails?.id === 'MX'

        let bankDetails = `Bank Transfer Details:
Amount: ${formattedAmount}
Bank Name: ${onrampData?.depositInstructions?.bankName || 'Loading...'}`

        // Only include Bank Address for non-Mexico countries
        if (!isMexico) {
            bankDetails += `
Bank Address: ${onrampData?.depositInstructions?.bankAddress || 'Loading...'}`

            const accountLabel = onrampData?.depositInstructions?.bankAccountNumber ? 'Account Number' : 'IBAN'
            const routingLabel = onrampData?.depositInstructions?.bankRoutingNumber ? 'Routing Number' : 'BIC'
            const accountValue =
                onrampData?.depositInstructions?.bankAccountNumber ||
                onrampData?.depositInstructions?.iban ||
                'Loading...'
            const routingValue =
                onrampData?.depositInstructions?.bankRoutingNumber ||
                onrampData?.depositInstructions?.bic ||
                'Loading...'

            bankDetails += `
${accountLabel}: ${accountValue}
${routingLabel}: ${routingValue}`
        }

        bankDetails += `
Deposit Message: ${onrampData?.depositInstructions?.depositMessage || 'Loading...'}

Please use these details to complete your bank transfer.`

        return bankDetails
    }

    const handleBack = () => {
        router.back()
    }

    if (!amountToOnramp) {
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
                    amount={amountToOnramp}
                    tokenSymbol={PEANUT_WALLET_TOKEN_SYMBOL}
                    countryCodeForFlag={countryCodeForFlag}
                />

                <Card className="rounded-sm">
                    <PaymentInfoRow
                        label={'Amount'}
                        value={formatCurrencyAmount(amountToOnramp, currentCountryDetails?.currency || 'USD')}
                    />
                    <PaymentInfoRow
                        label={'Bank Name'}
                        value={onrampData?.depositInstructions?.bankName || 'Loading...'}
                    />
                    {currentCountryDetails?.id !== 'MX' && (
                        <PaymentInfoRow
                            label={'Bank Address'}
                            value={onrampData?.depositInstructions?.bankAddress || 'Loading...'}
                        />
                    )}
                    {currentCountryDetails?.id !== 'MX' && (
                        <PaymentInfoRow
                            label={onrampData?.depositInstructions?.bankAccountNumber ? 'Account Number' : 'IBAN'}
                            value={
                                onrampData?.depositInstructions?.bankAccountNumber ||
                                onrampData?.depositInstructions?.iban ||
                                'Loading...'
                            }
                        />
                    )}
                    {currentCountryDetails?.id !== 'MX' && (
                        <PaymentInfoRow
                            label={onrampData?.depositInstructions?.bankRoutingNumber ? 'Routing Number' : 'BIC'}
                            value={
                                onrampData?.depositInstructions?.bankRoutingNumber ||
                                onrampData?.depositInstructions?.bic ||
                                'Loading...'
                            }
                        />
                    )}
                    <PaymentInfoRow
                        hideBottomBorder
                        label={'Deposit Message'}
                        value={onrampData?.depositInstructions?.depositMessage || 'Loading...'}
                        moreInfoText="Make sure you enter this exact message as the transfer concept or description. If it's not included, the deposit can't be processed."
                    />
                </Card>

                <div className="flex items-center gap-2 text-xs text-grey-1">
                    <Icon name="info" width={16} height={16} />
                    <span>Include the Deposit Message exactly as shown. It's required to process your deposit.</span>
                </div>

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

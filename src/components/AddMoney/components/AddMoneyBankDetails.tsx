'use client'

import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import ShareButton from '@/components/Global/ShareButton'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { countryCodeMap, countryData } from '@/components/AddMoney/consts'
import { formatCurrencyAmount } from '@/utils/currency'
import { formatBankAccountDisplay } from '@/utils/format.utils'
import Icon from '@/components/Global/Icon'
import { getCurrencySymbol, getOnrampCurrencyConfig } from '@/utils/bridge.utils'

export default function AddMoneyBankDetails() {
    const { amountToOnramp, onrampData, setOnrampData } = useOnrampFlow()
    const router = useRouter()
    const params = useParams()
    const currentCountryName = params.country as string

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

    const onrampCurrency = getOnrampCurrencyConfig(currentCountryDetails?.id || 'US').currency

    useEffect(() => {
        // If no amount is set, redirect back to add money page
        if (!amountToOnramp || parseFloat(amountToOnramp) <= 0) {
            router.replace('/add-money')
            return
        }
    }, [amountToOnramp, router])

    const generateBankDetails = async () => {
        const formattedAmount = formatCurrencyAmount(amountToOnramp, onrampCurrency)
        const isMexico = currentCountryDetails?.id === 'MX'

        let bankDetails = `Bank Transfer Details:
Amount: ${formattedAmount}
Bank Name: ${onrampData?.depositInstructions?.bankName || 'Loading...'}`

        // Only include Bank Address for non-Mexico countries since Mexico doesn't return IBAN/BIC or equivalent
        if (!isMexico) {
            bankDetails += `
Bank Address: ${onrampData?.depositInstructions?.bankAddress || 'Loading...'}`

            const accountLabel = onrampData?.depositInstructions?.bankAccountNumber ? 'Account Number' : 'IBAN'
            const routingLabel = onrampData?.depositInstructions?.bankRoutingNumber ? 'Routing Number' : 'BIC'
            const accountValue =
                onrampData?.depositInstructions?.bankAccountNumber ||
                (onrampData?.depositInstructions?.iban
                    ? formatBankAccountDisplay(onrampData.depositInstructions.iban, 'iban')
                    : null) ||
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
                    transactionType={'ADD_MONEY_BANK_ACCOUNT'}
                    recipientType={'BANK_ACCOUNT'}
                    recipientName={'Your Bank Account'}
                    amount={amountToOnramp}
                    tokenSymbol={PEANUT_WALLET_TOKEN_SYMBOL}
                    countryCodeForFlag={countryCodeForFlag}
                    currencySymbol={getCurrencySymbol(onrampCurrency)}
                />

                <Card className="rounded-sm">
                    <PaymentInfoRow label={'Amount'} value={formatCurrencyAmount(amountToOnramp, onrampCurrency)} />
                    <PaymentInfoRow
                        label={'Bank Name'}
                        value={onrampData?.depositInstructions?.bankName || 'Loading...'}
                        allowCopy={!!onrampData?.depositInstructions?.bankName}
                    />
                    {currentCountryDetails?.id !== 'MX' && (
                        <PaymentInfoRow
                            label={'Bank Address'}
                            value={onrampData?.depositInstructions?.bankAddress || 'Loading...'}
                            allowCopy={!!onrampData?.depositInstructions?.bankAddress}
                        />
                    )}
                    {currentCountryDetails?.id !== 'MX' && (
                        <PaymentInfoRow
                            label={onrampData?.depositInstructions?.bankAccountNumber ? 'Account Number' : 'IBAN'}
                            value={
                                onrampData?.depositInstructions?.bankAccountNumber ||
                                (onrampData?.depositInstructions?.iban
                                    ? formatBankAccountDisplay(onrampData.depositInstructions.iban, 'iban')
                                    : null) ||
                                'N/A'
                            }
                            allowCopy={!!(onrampData?.depositInstructions?.bankAccountNumber || onrampData?.depositInstructions?.iban)}
                        />
                    )}
                    {currentCountryDetails?.id !== 'MX' && (
                        <PaymentInfoRow
                            label={onrampData?.depositInstructions?.bankRoutingNumber ? 'Routing Number' : 'BIC'}
                            value={
                                onrampData?.depositInstructions?.bankRoutingNumber ||
                                onrampData?.depositInstructions?.bic ||
                                'N/A'
                            }
                            allowCopy={!!(onrampData?.depositInstructions?.bankRoutingNumber || onrampData?.depositInstructions?.bic)}
                        />
                    )}
                    <PaymentInfoRow
                        hideBottomBorder
                        label={'Deposit Message'}
                        value={onrampData?.depositInstructions?.depositMessage || 'Loading...'}
                        moreInfoText="Make sure you enter this exact message as the transfer concept or description. If it's not included, the deposit can't be processed."
                        allowCopy={!!onrampData?.depositInstructions?.depositMessage}
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

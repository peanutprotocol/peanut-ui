'use client'

import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import ShareButton from '@/components/Global/ShareButton'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { useRouter, useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo } from 'react'
import { type CountryData, countryData } from '@/components/AddMoney/consts'
import { formatCurrencyAmount } from '@/utils/currency'
import { formatBankAccountDisplay } from '@/utils/format.utils'
import { getCurrencyConfig, getCurrencySymbol } from '@/utils/bridge.utils'
import { RequestFulfillmentBankFlowStep, useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import { usePaymentStore } from '@/redux/hooks'
import { formatAmount } from '@/utils'
import useGetExchangeRate from '@/hooks/useGetExchangeRate'
import { AccountType } from '@/interfaces'
import InfoCard from '@/components/Global/InfoCard'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { Button } from '@/components/0_Bruddle'

interface IAddMoneyBankDetails {
    flow?: 'add-money' | 'request-fulfillment'
}

const getAccountTypeFromCountry = (country: CountryData | null): AccountType => {
    if (!country) return AccountType.US
    if (country.currency === 'MXN') return AccountType.CLABE
    if (country.currency === 'EUR') return AccountType.IBAN
    return AccountType.US
}

export default function AddMoneyBankDetails({ flow = 'add-money' }: IAddMoneyBankDetails) {
    const isAddMoneyFlow = flow === 'add-money'

    // contexts
    const onrampContext = useOnrampFlow()
    const {
        setFlowStep: setRequestFulfilmentBankFlowStep,
        onrampData: requestFulfilmentOnrampData,
        selectedCountry: requestFulfilmentSelectedCountry,
    } = useRequestFulfillmentFlow()
    const { chargeDetails } = usePaymentStore()

    // hooks
    const { exchangeRate, isFetchingRate } = useGetExchangeRate({
        accountType: getAccountTypeFromCountry(requestFulfilmentSelectedCountry),
    })

    // data from contexts based on flow
    const amount = isAddMoneyFlow ? onrampContext.amountToOnramp : chargeDetails?.tokenAmount
    const onrampData = isAddMoneyFlow ? onrampContext.onrampData : requestFulfilmentOnrampData

    const currencySymbolBasedOnCountry = useMemo(() => {
        return getCurrencySymbol(getCurrencyConfig(requestFulfilmentSelectedCountry?.id ?? 'US', 'onramp').currency)
    }, [requestFulfilmentSelectedCountry])

    const amountBasedOnCurrencyExchangeRate = useCallback(
        (amount: string) => {
            if (!exchangeRate) return currencySymbolBasedOnCountry + ' ' + amount
            return (
                currencySymbolBasedOnCountry + ' ' + formatAmount(parseFloat(amount ?? '0') * parseFloat(exchangeRate))
            )
        },
        [exchangeRate, currencySymbolBasedOnCountry]
    )

    const router = useRouter()
    const params = useParams()
    const currentCountryName = params.country as string

    // get country information from URL params
    const currentCountryDetails = useMemo(() => {
        if (!isAddMoneyFlow) {
            return requestFulfilmentSelectedCountry
        }
        // check if we have country params (from dynamic route)
        if (currentCountryName) {
            return countryData.find(
                (country) => country.type === 'country' && country.path === currentCountryName.toLowerCase()
            )
        }

        // check if we're on the static US route by examining the current pathname
        if (typeof window !== 'undefined' && window.location.pathname.includes('/add-money/us/bank')) {
            return countryData.find((c) => c.id === 'US')
        }

        // default to US if no country is detected
        return countryData.find((c) => c.id === 'US')
    }, [isAddMoneyFlow, requestFulfilmentSelectedCountry, currentCountryName])

    const onrampCurrency = getCurrencyConfig(currentCountryDetails?.id || 'US', 'onramp').currency

    useEffect(() => {
        // if no amount is set, redirect back to add money page
        if (isAddMoneyFlow) {
            if (!amount || parseFloat(amount) <= 0) {
                router.replace('/add-money')
                return
            }
        }
    }, [amount, router, isAddMoneyFlow])

    const formattedCurrencyAmount = useMemo(() => {
        if (!amount) return ''

        if (flow === 'request-fulfillment') {
            return formatCurrencyAmount(amount, 'USD') // Request fulfillment flow is in USD
        }

        return formatCurrencyAmount(amount, onrampCurrency)
    }, [amount, onrampCurrency, flow])

    const generateBankDetails = async () => {
        const formattedAmount = formattedCurrencyAmount
        const isMexico = currentCountryDetails?.id === 'MX'

        let bankDetails = `Bank Transfer Details:
Amount: ${formattedAmount}
Bank Name: ${onrampData?.depositInstructions?.bankName || 'Loading...'}`

        // only include Bank Address for non-Mexico countries since Mexico doesn't return IBAN/BIC or equivalent
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
Deposit Reference: ${onrampData?.depositInstructions?.depositMessage || 'Loading...'}

Please use these details to complete your bank transfer.`

        return bankDetails
    }

    const handleBack = () => {
        if (isAddMoneyFlow) {
            router.back()
        } else {
            setRequestFulfilmentBankFlowStep(RequestFulfillmentBankFlowStep.BankCountryList)
        }
    }

    if (!amount) {
        return null
    }

    return (
        <div className="flex h-full w-full flex-col justify-start gap-8 self-start">
            <NavHeader title={'Transfer details'} onPrev={handleBack} />

            <div className="my-auto flex h-full w-full flex-col justify-center space-y-4 pb-5">
                <Card className="p-4">
                    <p className="text-xs font-normal text-gray-1">Amount to send</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-extrabold text-black md:text-4xl">{formattedCurrencyAmount}</p>
                        <CopyToClipboard textToCopy={formattedCurrencyAmount} fill="black" iconSize="3" />
                    </div>

                    <InfoCard variant="error" className="mt-4" icon="alert" description="Send exactly this amount!" />
                </Card>

                <Card className="p-4">
                    <p className="text-xs font-normal text-gray-1">Deposit reference</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-xl font-extrabold text-black md:text-4xl">
                            {onrampData?.depositInstructions?.depositMessage || 'Loading...'}
                        </p>
                        {onrampData?.depositInstructions?.depositMessage && (
                            <CopyToClipboard
                                textToCopy={onrampData.depositInstructions.depositMessage}
                                fill="black"
                                iconSize="3"
                            />
                        )}
                    </div>

                    <InfoCard
                        variant="error"
                        className="mt-4"
                        icon="alert"
                        description="Paste in your bank's reference field"
                    />
                </Card>

                <Card className="gap-2 rounded-sm">
                    <h1 className="text-xs">Bank Details</h1>

                    <PaymentInfoRow
                        label={'Bank Name'}
                        value={onrampData?.depositInstructions?.bankName || 'Loading...'}
                        allowCopy={!!onrampData?.depositInstructions?.bankName}
                        hideBottomBorder
                    />
                    {currentCountryDetails?.id !== 'MX' && (
                        <PaymentInfoRow
                            label={'Bank Address'}
                            value={onrampData?.depositInstructions?.bankAddress || 'Loading...'}
                            allowCopy={!!onrampData?.depositInstructions?.bankAddress}
                            hideBottomBorder
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
                            allowCopy={
                                !!(
                                    onrampData?.depositInstructions?.bankAccountNumber ||
                                    onrampData?.depositInstructions?.iban
                                )
                            }
                            copyValue={
                                onrampData?.depositInstructions?.bankAccountNumber ||
                                onrampData?.depositInstructions?.iban
                            }
                            hideBottomBorder
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
                            allowCopy={
                                !!(
                                    onrampData?.depositInstructions?.bankRoutingNumber ||
                                    onrampData?.depositInstructions?.bic
                                )
                            }
                            hideBottomBorder
                        />
                    )}
                </Card>

                <InfoCard
                    variant="warning"
                    icon="alert"
                    title="Double check in your bank before sending:"
                    items={[
                        `Amount: ${formattedCurrencyAmount} (exact)`,
                        `Reference: ${onrampData?.depositInstructions?.depositMessage || 'Loading...'} (included)`,
                    ]}
                />

                <Button onClick={() => router.push('/home')} variant="purple" className="w-full" shadowSize="4">
                    I've sent the transfer
                </Button>

                <ShareButton
                    generateText={generateBankDetails}
                    title="Bank Transfer Details"
                    variant="primary-soft"
                    className="w-full"
                >
                    Share Details
                </ShareButton>
            </div>
        </div>
    )
}

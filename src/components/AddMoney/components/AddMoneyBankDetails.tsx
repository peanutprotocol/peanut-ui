'use client'

import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard, { PeanutActionDetailsCardProps } from '@/components/Global/PeanutActionDetailsCard'
import ShareButton from '@/components/Global/ShareButton'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { useRouter, useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo } from 'react'
import { ALL_COUNTRIES_ALPHA3_TO_ALPHA2, CountryData, countryData } from '@/components/AddMoney/consts'
import { formatCurrencyAmount } from '@/utils/currency'
import { formatBankAccountDisplay } from '@/utils/format.utils'
import Icon from '@/components/Global/Icon'
import { getCurrencyConfig, getCurrencySymbol } from '@/utils/bridge.utils'
import { RequestFulfillmentBankFlowStep, useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import { usePaymentStore } from '@/redux/hooks'
import { formatAmount, printableAddress } from '@/utils'
import useGetExchangeRate from '@/hooks/useGetExchangeRate'
import { AccountType } from '@/interfaces'

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

    const countryCodeForFlag = useMemo(() => {
        const countryId = currentCountryDetails?.id || 'USA'
        const countryCode = ALL_COUNTRIES_ALPHA3_TO_ALPHA2[countryId] || countryId // if countryId is not in countryCodeMap, use countryId because for some countries countryId is of 2 digit and countryCodeMap is a mapping of 3 digit to 2 digit country codes
        return countryCode?.toLowerCase() || 'us'
    }, [currentCountryDetails])

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

    const generateBankDetails = async () => {
        const formattedAmount = formatCurrencyAmount(amount ?? '0', onrampCurrency)
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
Deposit Message: ${onrampData?.depositInstructions?.depositMessage || 'Loading...'}

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

    const peanutActionDetailsCardProps = useMemo<PeanutActionDetailsCardProps>(() => {
        if (isAddMoneyFlow) {
            return {
                avatarSize: 'small',
                transactionType: 'ADD_MONEY_BANK_ACCOUNT',
                recipientType: 'BANK_ACCOUNT',
                recipientName: 'Your Bank Account',
                amount: amount ?? '0',
                tokenSymbol: PEANUT_WALLET_TOKEN_SYMBOL,
                countryCodeForFlag: countryCodeForFlag,
                currencySymbol: getCurrencySymbol(onrampCurrency),
            }
        } else {
            return {
                avatarSize: 'small',
                transactionType: 'REQUEST_PAYMENT',
                recipientType: 'USERNAME',
                recipientName:
                    chargeDetails?.requestLink.recipientAccount.user.username ??
                    printableAddress(chargeDetails?.requestLink.recipientAddress as string),
                amount: isFetchingRate ? '-' : amountBasedOnCurrencyExchangeRate(amount ?? '0'),
                tokenSymbol: '',
                countryCodeForFlag: countryCodeForFlag,
                currencySymbol: getCurrencySymbol(onrampCurrency),
            }
        }
    }, [
        isAddMoneyFlow,
        amount,
        countryCodeForFlag,
        onrampCurrency,
        chargeDetails,
        isFetchingRate,
        amountBasedOnCurrencyExchangeRate,
    ])

    if (!amount) {
        return null
    }

    return (
        <div className="flex h-full w-full flex-col justify-start gap-8 self-start">
            <NavHeader title={isAddMoneyFlow ? 'Add Money' : 'Send'} onPrev={handleBack} />

            <div className="my-auto flex h-full w-full flex-col justify-center space-y-4 pb-5">
                <PeanutActionDetailsCard {...peanutActionDetailsCardProps} />

                <Card className="rounded-sm">
                    {flow === 'add-money' && (
                        <PaymentInfoRow label={'Amount'} value={formatCurrencyAmount(amount, onrampCurrency)} />
                    )}
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

'use client'

import { Button } from '@/components/0_Bruddle'
import { countryCodeMap } from '@/components/AddMoney/consts'
import Card from '@/components/Global/Card'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'
import { useMemo } from 'react'
import { ClaimLinkData } from '@/services/sendLinks'
import { formatUnits } from 'viem'
import ExchangeRate from '@/components/ExchangeRate'
import { AccountType } from '@/interfaces'
import { useCurrency } from '@/hooks/useCurrency'
import { getCurrencySymbol } from '@/utils/bridge.utils'

interface ConfirmBankClaimViewProps {
    onConfirm: () => void
    onBack: () => void
    isProcessing?: boolean
    error?: string | null
    bankDetails: IBankAccountDetails
    fullName: string
    claimLinkData: ClaimLinkData
}

export function ConfirmBankClaimView({
    onConfirm,
    onBack,
    isProcessing,
    error,
    bankDetails,
    fullName,
    claimLinkData,
}: ConfirmBankClaimViewProps) {
    const displayedFullName = useMemo(() => {
        if (fullName) return fullName
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('receiverFullName') ?? ''
        }
        return ''
    }, [fullName])

    const accountType = useMemo(() => {
        if (bankDetails.iban) return AccountType.IBAN
        if (bankDetails.clabe) return AccountType.CLABE
        if (bankDetails.accountNumber && bankDetails.routingNumber) return AccountType.US
        return AccountType.IBAN // Default or handle error
    }, [bankDetails])

    const countryCodeForFlag = useMemo(() => {
        return countryCodeMap[bankDetails?.country?.toUpperCase()] ?? bankDetails.country.toUpperCase()
    }, [bankDetails.country])

    // amount in USD from claim link data
    const usdAmount = useMemo(
        () => formatUnits(claimLinkData?.amount ?? 0, claimLinkData?.tokenDecimals) || '0.00',
        [claimLinkData]
    )

    // determine display currency based on account type
    const currencyCode = useMemo(() => {
        if (accountType === AccountType.CLABE) return 'MXN'
        if (accountType === AccountType.US) return 'USD'
        return 'EUR'
    }, [accountType])

    // fetch exchange rate and symbol (USD -> local currency)
    const { symbol: resolvedSymbol, price, isLoading: isLoadingCurrency } = useCurrency(currencyCode)

    // fallback if conversion fails
    const failedConversion = useMemo(() => {
        return currencyCode !== 'USD' && !isLoadingCurrency && (!price || isNaN(price))
    }, [currencyCode, isLoadingCurrency, price])

    // display amount in local currency
    const displayAmount = useMemo(() => {
        if (currencyCode === 'USD') return usdAmount
        if (isLoadingCurrency) return '-'
        if (!price || isNaN(price)) return usdAmount
        const converted = (Number(usdAmount) * price).toFixed(2)
        return converted
    }, [price, usdAmount, currencyCode, isLoadingCurrency])

    const displaySymbol = useMemo(() => {
        if (currencyCode === 'USD') return '$'
        // fallback to $ if conversion fails
        if (failedConversion) return '$'
        return resolvedSymbol ?? getCurrencySymbol(currencyCode)
    }, [currencyCode, resolvedSymbol, failedConversion])

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8 md:min-h-fit">
            <div>
                <NavHeader title="Receive" onPrev={onBack} />
            </div>
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <PeanutActionDetailsCard
                    countryCodeForFlag={countryCodeForFlag.toLowerCase()}
                    avatarSize="small"
                    transactionType="CLAIM_LINK_BANK_ACCOUNT"
                    recipientType="BANK_ACCOUNT"
                    recipientName={bankDetails.country}
                    amount={displayAmount}
                    tokenSymbol={claimLinkData.tokenSymbol}
                    currencySymbol={displaySymbol}
                    isLoading={isLoadingCurrency}
                />

                <Card className="rounded-sm">
                    {/* todo: take full name from user, this name rn is of senders */}
                    <PaymentInfoRow label="Full name" value={displayedFullName} />
                    {bankDetails.iban && <PaymentInfoRow label="IBAN" value={bankDetails.iban.toUpperCase()} />}
                    {bankDetails.bic && <PaymentInfoRow label="BIC" value={bankDetails.bic.toUpperCase()} />}
                    {bankDetails.clabe && <PaymentInfoRow label="CLABE" value={bankDetails.clabe.toUpperCase()} />}
                    {bankDetails.accountNumber && (
                        <PaymentInfoRow label="Account Number" value={bankDetails.accountNumber.toUpperCase()} />
                    )}
                    {bankDetails.routingNumber && (
                        <PaymentInfoRow label="Routing Number" value={bankDetails.routingNumber.toUpperCase()} />
                    )}
                    <ExchangeRate accountType={accountType} />
                    <PaymentInfoRow hideBottomBorder label="Fee" value={`$ 0.00`} />
                </Card>

                <div className="space-y-4">
                    {error ? (
                        <Button
                            variant="purple"
                            shadowSize="4"
                            onClick={onConfirm}
                            disabled={false}
                            loading={false}
                            className="w-full"
                            icon="retry"
                        >
                            Retry
                        </Button>
                    ) : (
                        <Button
                            variant="purple"
                            shadowSize="4"
                            onClick={onConfirm}
                            disabled={isProcessing}
                            loading={isProcessing}
                            className="w-full"
                            icon="arrow-down"
                        >
                            Receive now
                        </Button>
                    )}

                    {error && <ErrorAlert description={error} />}
                </div>
            </div>
        </div>
    )
}

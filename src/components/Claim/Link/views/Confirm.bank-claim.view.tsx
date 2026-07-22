'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { ALL_COUNTRIES_ALPHA3_TO_ALPHA2 } from '@/components/AddMoney/consts'
import Card from '@/components/Global/Card'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { type IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'
import { useMemo } from 'react'
import { type ClaimLinkData } from '@/services/sendLinks'
import { formatUnits } from 'viem'
import ExchangeRate from '@/components/ExchangeRate'
import { AccountType } from '@/interfaces/interfaces'
import countryCurrencyMappings from '@/constants/countryCurrencyMapping'
import { useTranslations } from 'next-intl'

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
    const t = useTranslations('claim')
    const tCommon = useTranslations('common')
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
        return ALL_COUNTRIES_ALPHA3_TO_ALPHA2[bankDetails?.country?.toUpperCase()] ?? bankDetails.country.toUpperCase()
    }, [bankDetails.country])

    // amount in USD from claim link data
    const usdAmount = useMemo(
        () => formatUnits(claimLinkData?.amount ?? 0, claimLinkData?.tokenDecimals) || '0.00',
        [claimLinkData]
    )

    const nonEuroCurrency = countryCurrencyMappings.find(
        (currency) => countryCodeForFlag.toLowerCase() === currency.flagCode.toLowerCase()
    )?.currencyCode

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8 md:min-h-fit">
            <div>
                <NavHeader title={t('receive')} onPrev={onBack} />
            </div>
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <PeanutActionDetailsCard
                    countryCodeForFlag={countryCodeForFlag.toLowerCase()}
                    avatarSize="small"
                    transactionType="CLAIM_LINK_BANK_ACCOUNT"
                    recipientType="BANK_ACCOUNT"
                    recipientName={bankDetails.country}
                    amount={usdAmount}
                    tokenSymbol={claimLinkData.tokenSymbol}
                />

                <Card className="rounded-sm">
                    {/* todo: take full name from user, this name rn is of senders */}
                    <PaymentInfoRow label={t('bank.fullName')} value={displayedFullName} />
                    {bankDetails.iban && <PaymentInfoRow label="IBAN" value={bankDetails.iban.toUpperCase()} />}
                    {bankDetails.bic && <PaymentInfoRow label="BIC" value={bankDetails.bic.toUpperCase()} />}
                    {bankDetails.clabe && <PaymentInfoRow label="CLABE" value={bankDetails.clabe.toUpperCase()} />}
                    {bankDetails.accountNumber && (
                        <PaymentInfoRow
                            label={t('bank.accountNumber')}
                            value={bankDetails.accountNumber.toUpperCase()}
                        />
                    )}
                    {bankDetails.routingNumber && (
                        <PaymentInfoRow
                            label={t('bank.routingNumber')}
                            value={bankDetails.routingNumber.toUpperCase()}
                        />
                    )}
                    <ExchangeRate accountType={accountType} nonEuroCurrency={nonEuroCurrency} />
                    <PaymentInfoRow hideBottomBorder label={t('fee')} value={`$ 0.00`} />
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
                            {tCommon('retry')}
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
                            {t('receiveNow')}
                        </Button>
                    )}

                    {error && <ErrorAlert description={error} />}
                </div>
            </div>
        </div>
    )
}

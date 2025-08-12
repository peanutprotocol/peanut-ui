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
        return countryCodeMap[bankDetails.country.toUpperCase()] ?? bankDetails.country.toUpperCase()
    }, [bankDetails.country])

    return (
        <div className="flex flex-col justify-between gap-8">
            <div className="md:hidden">
                <NavHeader title="Receive" onPrev={onBack} />
            </div>
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <PeanutActionDetailsCard
                    countryCodeForFlag={countryCodeForFlag.toLowerCase()}
                    avatarSize="small"
                    transactionType="CLAIM_LINK_BANK_ACCOUNT"
                    recipientType="BANK_ACCOUNT"
                    recipientName={bankDetails.country}
                    amount={formatUnits(claimLinkData?.amount ?? 0, claimLinkData?.tokenDecimals) || '0.00'}
                    tokenSymbol={claimLinkData.tokenSymbol}
                />

                <Card className="rounded-sm">
                    {/* todo: take full name from user, this name rn is of senders */}
                    <PaymentInfoRow label="Full name" value={displayedFullName} />
                    {bankDetails.iban && <PaymentInfoRow label="IBAN" value={bankDetails.iban} />}
                    {bankDetails.bic && <PaymentInfoRow label="BIC" value={bankDetails.bic} />}
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

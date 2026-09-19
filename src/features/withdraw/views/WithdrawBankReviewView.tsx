'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import { ALL_COUNTRIES_ALPHA3_TO_ALPHA2 } from '@/components/AddMoney/consts'
import Card from '@/components/Global/Card'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'
import ExchangeRate from '@/components/ExchangeRate'
import countryCurrencyMappings, { isNonEuroSepaCountry } from '@/constants/countryCurrencyMapping'
import { AccountType, type Account } from '@/interfaces/interfaces'
import { formatIban } from '@/utils/general.utils'
import { type FC, useState } from 'react'
import { Field } from '@/components/0_Bruddle/Field'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { type BankReferenceProblem, type BankReferenceSpec } from '@/features/withdraw/bank-reference'
import { useAuth } from '@/context/authContext'
import { useTranslations } from 'next-intl'

interface WithdrawBankReviewViewProps {
    bankAccount: Account
    amount: string
    country: string
    fromSendFlow: boolean
    isLoading: boolean
    /** false while the spendable balance or the rail-minimum FX rate loads — submit stays disabled (Chip rounds 3+5). */
    isSubmitReady: boolean
    /** On-chain leg already fired — never offer Retry (double-pay). */
    submittedTxHash: string | null
    error: { showError: boolean; errorMessage: string }
    balanceErrorMessage: string | null
    confirmPendingCopy: string
    /** The limits of the rail's reference field; null when the rail takes none. */
    referenceSpec: BankReferenceSpec | null
    reference: string
    referenceProblem: BankReferenceProblem | null
    onReferenceChange: (reference: string) => void
    onSubmit: () => void
    onDone: () => void
}

/** Review step of the Bridge bank withdraw — dumb view, logic in useBridgeOfframpFlow. */
export const WithdrawBankReviewView: FC<WithdrawBankReviewViewProps> = ({
    bankAccount,
    amount,
    country,
    fromSendFlow,
    isLoading,
    isSubmitReady,
    submittedTxHash,
    error,
    balanceErrorMessage,
    confirmPendingCopy,
    referenceSpec,
    reference,
    referenceProblem,
    onReferenceChange,
    onSubmit,
    onDone,
}) => {
    // a half-typed reference is not an error yet — name the problem on blur
    const [referenceTouched, setReferenceTouched] = useState(false)
    const t = useTranslations('withdraw')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const { user } = useAuth()

    const nonEuroCurrency = countryCurrencyMappings.find(
        (currency) =>
            country.toLowerCase() === currency.country.toLowerCase() ||
            currency.path?.toLowerCase() === country.toLowerCase()
    )?.currencyCode

    const referenceErrorText = (problem: BankReferenceProblem) => {
        if (!referenceSpec) return undefined
        if (problem === 'tooShort') return t('bank.referenceTooShort', { min: referenceSpec.minLength })
        if (problem === 'tooLong') return t('bank.referenceTooLong', { max: referenceSpec.maxLength })
        return t(`bank.${referenceSpec.invalidCharsKey}`)
    }

    // non-eur sepa countries that are currently experiencing issues
    const isNonEuroSepa = isNonEuroSepaCountry(nonEuroCurrency)

    const countryCodeForFlag = () => {
        if (!bankAccount?.details?.countryCode) return ''
        const code =
            ALL_COUNTRIES_ALPHA3_TO_ALPHA2[bankAccount.details.countryCode ?? ''] ?? bankAccount.details.countryCode
        return code.toLowerCase()
    }

    const getBicAndRoutingNumber = () => {
        if (bankAccount.type === AccountType.IBAN) {
            return bankAccount.bic?.toUpperCase() ?? 'N/A'
        } else if (bankAccount.type === AccountType.US) {
            return bankAccount.routingNumber?.toUpperCase() ?? 'N/A'
        } else if (bankAccount.type === AccountType.CLABE) {
            return bankAccount.identifier?.toUpperCase() ?? 'N/A'
        } else if (bankAccount.type === AccountType.GB) {
            return bankAccount.sortCode ?? 'N/A'
        }
        return 'N/A'
    }

    return (
        <div className="my-auto space-y-4 flex h-full w-full flex-col justify-center pb-4">
            <PeanutActionDetailsCard
                countryCodeForFlag={countryCodeForFlag()}
                avatarSize="small"
                transactionType={'WITHDRAW_BANK_ACCOUNT'}
                recipientType={'BANK_ACCOUNT'}
                recipientName={bankAccount?.identifier ?? t('bank.bankAccount')}
                amount={amount}
                tokenSymbol={PEANUT_WALLET_TOKEN_SYMBOL}
                isFromSendFlow={fromSendFlow}
            />

            {/* Warning for non-EUR SEPA countries (not UK — UK uses Faster Payments with GBP) */}
            {isNonEuroSepa && bankAccount?.type !== AccountType.GB && (
                <Notification priority="info" title={t('bank.eurTitle')}>
                    {t('bank.eurDescription')}
                </Notification>
            )}

            <Card className="rounded-sm">
                <PaymentInfoRow
                    label={t('bank.accountOwner')}
                    value={bankAccount?.details?.accountOwnerName || user?.user.fullName || 'N/A'}
                />
                {bankAccount?.type === AccountType.IBAN ? (
                    <>
                        <PaymentInfoRow
                            label={t('bank.iban')}
                            value={
                                bankAccount?.identifier
                                    ? formatIban(bankAccount.identifier)
                                    : '' /* fallback to empty string to avoid runtime error */
                            }
                        />
                        <PaymentInfoRow label={t('bank.bic')} value={getBicAndRoutingNumber()} />
                    </>
                ) : bankAccount?.type === AccountType.CLABE ? (
                    <PaymentInfoRow label={t('bank.clabe')} value={bankAccount?.identifier.toUpperCase()} />
                ) : bankAccount?.type === AccountType.CO_BANK_TRANSFER ? (
                    // A Colombian account is named by its number alone; the bank
                    // code is not shown back to the user.
                    <PaymentInfoRow label={t('bank.accountNumber')} value={bankAccount?.identifier} />
                ) : bankAccount?.type === AccountType.GB ? (
                    <>
                        <PaymentInfoRow label={t('bank.accountNumber')} value={bankAccount?.identifier} />
                        <PaymentInfoRow label={t('bank.sortCode')} value={getBicAndRoutingNumber()} />
                    </>
                ) : (
                    <>
                        <PaymentInfoRow label={t('bank.accountNumber')} value={bankAccount?.identifier} />
                        <PaymentInfoRow label={t('bank.routingNumber')} value={getBicAndRoutingNumber()} />
                    </>
                )}
                <ExchangeRate
                    accountType={bankAccount.type}
                    nonEuroCurrency={nonEuroCurrency}
                    amountToConvert={amount}
                />
                <PaymentInfoRow hideBottomBorder label={t('bank.fee')} value={`$ 0.00`} />
            </Card>

            {referenceSpec && (
                <Field
                    label={t('bank.reference')}
                    htmlFor="withdraw-bank-reference"
                    helper={t(`bank.${referenceSpec.helperKey}`)}
                    error={referenceTouched && referenceProblem ? referenceErrorText(referenceProblem) : undefined}
                >
                    <BaseInput
                        id="withdraw-bank-reference"
                        value={reference}
                        maxLength={referenceSpec.maxLength}
                        // the transfer is created with the reference; it cannot change after
                        disabled={isLoading || !!submittedTxHash}
                        onChange={(e) => onReferenceChange(e.target.value)}
                        onBlur={() => setReferenceTouched(true)}
                        className="text-body-s"
                    />
                </Field>
            )}

            {submittedTxHash ? (
                // On-chain leg already fired. Even if confirmOfframp failed
                // we must NOT offer Retry — it would re-run sendMoney() and
                // double-pay (Sentry PEANUT-UI-QH9). Surface the in-progress
                // state and a Done button that takes the user home.
                <Button shadowSize="4" className="w-full" onClick={onDone}>
                    {tCommon('done')}
                </Button>
            ) : error.showError ? (
                <Button
                    disabled={isLoading}
                    onClick={onSubmit}
                    loading={isLoading}
                    shadowSize="4"
                    className="w-full"
                    icon="retry"
                    iconSize={14}
                >
                    {tCommon('retry')}
                </Button>
            ) : (
                <Button
                    icon="arrow-up"
                    loading={isLoading}
                    iconSize={12}
                    shadowSize="4"
                    onClick={onSubmit}
                    disabled={
                        isLoading || !bankAccount || !!balanceErrorMessage || !isSubmitReady || !!referenceProblem
                    }
                    className="w-full"
                >
                    {tNav(fromSendFlow ? 'send' : 'withdraw')}
                </Button>
            )}
            {submittedTxHash ? (
                <Notification priority="info" title={t('bank.transferProcessing')}>
                    {confirmPendingCopy}
                </Notification>
            ) : (
                error.showError && <Notification priority="error">{error.errorMessage}</Notification>
            )}
            {balanceErrorMessage && <Notification priority="error">{balanceErrorMessage}</Notification>}
        </div>
    )
}

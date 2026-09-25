'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import VerificationDeadlineNotice from '@/components/Kyc/VerificationDeadlineNotice'
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
import {
    type BankReferenceProblem,
    type BankReferenceSpec,
    type PayoutDefaultReferenceNoteKey,
    type PayoutNoteKey,
} from '@/features/withdraw/bank-reference'
import { useTranslations } from 'next-intl'
import RecipientGetsRow from '@/components/ExchangeRate/RecipientGetsRow'
import RateUnavailable from '@/components/Global/RateUnavailable'

interface WithdrawBankReviewViewProps {
    bankAccount: Account
    /** USDC that leaves the balance. */
    amount: string
    /** Bank amount typed in its currency (TASK-23054), and the quote rate behind `amount`. */
    bankAmount?: { currency: string; destinationAmount: string; rate: string }
    fromSendFlow: boolean
    /** ISO date a future-dated verification becomes due; shows a non-blocking heads-up. */
    verificationDeadline?: string
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
    /** `withdraw.bank` key for the rail's payout note; null when we have nothing true to say. */
    payoutNoteKey: PayoutNoteKey | null
    /** Extra sentence that holds only while the user typed no reference; null when the rail has none. */
    payoutDefaultReferenceNoteKey: PayoutDefaultReferenceNoteKey | null
    reference: string
    referenceProblem: BankReferenceProblem | null
    onReferenceChange: (reference: string) => void
    onSubmit: () => void
    onDone: () => void
    /** Set while the quote's last refresh failed: the amounts stay, submit waits for a fresh quote. */
    onRetryQuote?: () => void
    /** Set when the provider refused the saved account for good: add it again replaces Retry. */
    onAddBankAccountAgain?: () => void
}

/** Review step of the Bridge bank withdraw — dumb view, logic in useBridgeOfframpFlow. */
export const WithdrawBankReviewView: FC<WithdrawBankReviewViewProps> = ({
    bankAccount,
    amount,
    bankAmount,
    fromSendFlow,
    verificationDeadline,
    isLoading,
    isSubmitReady,
    submittedTxHash,
    error,
    balanceErrorMessage,
    confirmPendingCopy,
    referenceSpec,
    payoutNoteKey,
    payoutDefaultReferenceNoteKey,
    reference,
    referenceProblem,
    onReferenceChange,
    onSubmit,
    onDone,
    onRetryQuote,
    onAddBankAccountAgain,
}) => {
    // a half-typed reference is not an error yet — name the problem on blur
    const [referenceTouched, setReferenceTouched] = useState(false)
    const t = useTranslations('withdraw')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')

    // ONE country drives this screen: the account's own, read off the IBAN.
    // The country picked upstream is not the same thing — a Portugal resident
    // with a Lithuanian IBAN who picked Poland got a Lithuanian flag beside a
    // zloty conversion quote — and since the euro area became one destination
    // there is often no picked country at all (QA round 3, W1).
    const accountCountryCode = (
        ALL_COUNTRIES_ALPHA3_TO_ALPHA2[bankAccount?.details?.countryCode ?? ''] ??
        bankAccount?.details?.countryCode ??
        ''
    ).toLowerCase()

    const nonEuroCurrency = countryCurrencyMappings.find(
        (currency) => currency.flagCode.toLowerCase() === accountCountryCode
    )?.currencyCode

    const referenceErrorText = (problem: BankReferenceProblem) => {
        if (!referenceSpec) return undefined
        if (problem === 'tooShort') return t('bank.referenceTooShort', { min: referenceSpec.minLength })
        if (problem === 'tooLong') return t('bank.referenceTooLong', { max: referenceSpec.maxLength })
        return t(`bank.${referenceSpec.invalidCharsKey}`)
    }

    // non-eur sepa countries that are currently experiencing issues
    const isNonEuroSepa = isNonEuroSepaCountry(nonEuroCurrency)

    const getBicAndRoutingNumber = () => {
        if (bankAccount.type === AccountType.US) {
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
                countryCodeForFlag={accountCountryCode}
                avatarSize="m"
                transactionType={'WITHDRAW_BANK_ACCOUNT'}
                recipientType={'BANK_ACCOUNT'}
                recipientName={bankAccount?.identifier ?? t('bank.bankAccount')}
                amount={amount}
                tokenSymbol={PEANUT_WALLET_TOKEN_SYMBOL}
                isFromSendFlow={fromSendFlow}
            />

            {/* Warning for non-EUR SEPA countries (not UK — UK uses Faster Payments with GBP) */}
            {isNonEuroSepa && bankAccount?.type !== AccountType.GB && (
                <Callout priority="info" title={t('bank.eurTitle')}>
                    {t('bank.eurDescription')}
                </Callout>
            )}

            {verificationDeadline && <VerificationDeadlineNotice effectiveDate={verificationDeadline} />}

            <Card className="rounded-sm">
                {/* The holder is whoever the account was saved under — often not
                    the user (a parent, a partner). When no name was stored, leave
                    the row out: the user's own name here would be a wrong claim. */}
                {bankAccount?.details?.accountOwnerName && (
                    <PaymentInfoRow label={t('bank.accountOwner')} value={bankAccount.details.accountOwnerName} />
                )}
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
                        {/* The form no longer asks for a BIC, so a new euro
                            account has none. Show the row only for the saved
                            accounts that still carry one — an empty "N/A" row
                            tells the user nothing. */}
                        {bankAccount.bic && (
                            <PaymentInfoRow label={t('bank.bic')} value={bankAccount.bic.toUpperCase()} />
                        )}
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
                {bankAmount ? (
                    <>
                        <PaymentInfoRow
                            label={tCommon('exchangeRate')}
                            value={`1 USD = ${Number(bankAmount.rate).toFixed(4)} ${bankAmount.currency.toUpperCase()}`}
                        />
                        <RecipientGetsRow amount={bankAmount.destinationAmount} currency={bankAmount.currency} />
                    </>
                ) : (
                    <ExchangeRate
                        accountType={bankAccount.type}
                        nonEuroCurrency={nonEuroCurrency}
                        amountToConvert={amount}
                    />
                )}
                <PaymentInfoRow hideBottomBorder label={t('bank.fee')} value={'$0'} />
            </Card>

            {payoutNoteKey && (
                <p className="text-body-xs text-foreground-secondary">
                    {t(`bank.${payoutNoteKey}`)}
                    {/* The default reference carries the user's name, and a
                        reference they type replaces it. Say so only while they
                        have typed none — after that the note above is the whole
                        story. */}
                    {payoutDefaultReferenceNoteKey && !reference.trim() && (
                        <> {t(`bank.${payoutDefaultReferenceNoteKey}`)}</>
                    )}
                </p>
            )}

            {referenceSpec && (
                <Field
                    label={t('bank.reference')}
                    htmlFor="withdraw-bank-reference"
                    helper={
                        <>
                            {t(`bank.${referenceSpec.helperKey}`)}
                            {/* The rail rewrites the text on some rails — the
                                receipt is where the user reads the final value. */}
                            {referenceSpec.rewrittenKey && <> {t(`bank.${referenceSpec.rewrittenKey}`)}</>}
                        </>
                    }
                    // After a failed submit there is nothing left to finish
                    // typing, so the reason shows without waiting for a blur.
                    error={
                        (referenceTouched || error.showError) && referenceProblem
                            ? referenceErrorText(referenceProblem)
                            : undefined
                    }
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

            {onRetryQuote && !submittedTxHash && <RateUnavailable onRetry={onRetryQuote} />}
            {submittedTxHash ? (
                // On-chain leg already fired. Even if confirmOfframp failed
                // we must NOT offer Retry — it would re-run sendMoney() and
                // double-pay (Sentry PEANUT-UI-QH9). Surface the in-progress
                // state and a Done button that takes the user home.
                <Button shadowSize="4" className="w-full" onClick={onDone}>
                    {tCommon('done')}
                </Button>
            ) : error.showError && onAddBankAccountAgain ? (
                <Button shadowSize="4" className="w-full" onClick={onAddBankAccountAgain}>
                    {t('withdrawToBank')}
                </Button>
            ) : error.showError ? (
                <Button
                    // Same guards as the normal submit below: the flow hook
                    // returns early on a reference problem or a quote that is
                    // not current, so without them Retry looks live and does nothing.
                    disabled={isLoading || !!referenceProblem || !isSubmitReady}
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
                <Callout priority="info" title={t('bank.transferProcessing')}>
                    {confirmPendingCopy}
                </Callout>
            ) : (
                error.showError && <Callout priority="error">{error.errorMessage}</Callout>
            )}
            {balanceErrorMessage && <Callout priority="error">{balanceErrorMessage}</Callout>}
        </div>
    )
}

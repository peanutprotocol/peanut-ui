'use client'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import NavHeader from '@/components/Global/NavHeader'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import PeanutActionCard from '@/components/Global/PeanutActionCard'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import AmountInput from '@/components/Global/AmountInput'
import { useTranslations } from 'next-intl'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useRequestBack } from '@/components/Request/useRequestBack'
import { BankInstructionsToggle } from './BankInstructionsToggle'
import { CreateRequestLinkCta } from './CreateRequestLinkCta'
import { RequestCurrencyPicker } from './RequestCurrencyPicker'
import { RequestFulfillmentNotice } from './RequestFulfillmentNotice'
import { useCreateRequestLink } from './useCreateRequestLink'

export const CreateRequestLinkView = () => {
    const t = useTranslations('request')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const onBack = useRequestBack()
    const depositAccountsEnabled = useDepositAccountsEnabled()
    const {
        requestAmount,
        currency,
        accountCurrencies,
        exchangeRate,
        attachmentOptions,
        errorState,
        generatedLink,
        requestId,
        isCreatingLink,
        isUpdatingRequest,
        qrCodeLink,
        bankInstructionsShared,
        setBankInstructionsShared,
        handleRequestAmountChange,
        handleCurrencyChange,
        handleAttachmentOptionsChange,
        handleTokenAmountSubmit,
        generateLink,
    } = useCreateRequestLink()

    return (
        <PageStack>
            <NavHeader onPrev={onBack} title={tNav('request')} />
            <PageStack.Center className="gap-4 md:my-0">
                {/* board order (17831:78719): card, amount, helper note, qr, message, cta */}
                <PeanutActionCard type="request" />

                <RequestCurrencyPicker
                    currency={currency}
                    onChange={handleCurrencyChange}
                    accountCurrencies={accountCurrencies}
                    disabled={!!requestId}
                />

                {/* Keyed on the currency: AmountInput reads its denominations
                    once, so a new currency needs a new input. A non-USD request
                    shows its dollar side as the secondary line, as add-money
                    does; with no rate yet it shows the amount alone. */}
                <AmountInput
                    key={currency}
                    className="w-full"
                    initialAmount={requestAmount}
                    setPrimaryAmount={handleRequestAmountChange}
                    onSubmit={handleTokenAmountSubmit}
                    disabled={!!requestId}
                    {...(currency !== 'USD' && {
                        primaryDenomination: { symbol: currency, price: exchangeRate || 1, decimals: 2 },
                        secondaryDenomination: exchangeRate > 0 ? { symbol: 'USD', price: 1, decimals: 2 } : undefined,
                    })}
                />

                {/* only meaningful while the amount is empty (coderabbit #2780) */}
                {(!requestAmount || Number(requestAmount) === 0) && (
                    <Notification priority="helper">{t('leaveEmptyHint')}</Notification>
                )}

                {/* Before a request exists the QR already encodes the profile
                    payment link for the entered amount, so it only stays
                    blurred while there's neither a request nor an amount. */}
                <QRCodeWrapper
                    isBlurred={!requestId && !(parseFloat(requestAmount) > 0)}
                    url={qrCodeLink}
                    isLoading={isCreatingLink || isUpdatingRequest}
                />

                <BaseInput
                    placeholder={tCommon('comment')}
                    value={attachmentOptions.message}
                    maxLength={140}
                    onChange={(e) => handleAttachmentOptionsChange({ ...attachmentOptions, message: e.target.value })}
                />

                {/* The opt-in belongs before Create: it is what the request is
                    created with, and it cannot be changed afterwards. */}
                {depositAccountsEnabled && !requestId && (
                    <BankInstructionsToggle
                        checked={bankInstructionsShared}
                        onChange={setBankInstructionsShared}
                        disabled={isCreatingLink}
                    />
                )}

                {requestId && <RequestFulfillmentNotice requestId={requestId} bankPayable={bankInstructionsShared} />}

                <CreateRequestLinkCta
                    requestId={requestId}
                    generatedLink={generatedLink}
                    isCreatingLink={isCreatingLink}
                    isUpdatingRequest={isUpdatingRequest}
                    requestAmount={requestAmount}
                    currency={currency}
                    onGenerate={generateLink}
                />

                {errorState.showError && (
                    <div className="text-start">
                        <label className="text-body-s font-normal text-foreground-error">
                            {errorState.errorMessage}
                        </label>
                    </div>
                )}
            </PageStack.Center>
        </PageStack>
    )
}

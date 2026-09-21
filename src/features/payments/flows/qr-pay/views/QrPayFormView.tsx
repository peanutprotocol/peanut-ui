'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { formatUnits } from 'viem'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import GlobalCard from '@/components/Global/Card'
import { Card } from '@/components/0_Bruddle/Card'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { Callout } from '@/components/0_Bruddle/Callout'
import NavHeader from '@/components/Global/NavHeader'
import AmountInput from '@/components/Global/AmountInput'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { useSumsubActionFlow } from '@/hooks/useSumsubActionFlow'
import { initiateIncreaseLimits } from '@/app/actions/increase-limits'
import { useLimits } from '@/hooks/useLimits'
import { useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { getLimitsWarningCardProps, isBrUserEligibleForLimitIncrease } from '@/features/limits/utils'
import { useCardMarkupRate } from '@/hooks/useCardMarkupRate'
import { useModalsContext } from '@/context/ModalsContext'
import { calculateSavingsInCents, hasCardMarkupComparison } from '@/utils/qr-payment.utils'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useQrPayFlow } from '../QrPayFlowContext'

export function QrPayFormView() {
    const t = useAppTranslations('qrPay')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const {
        paymentProcessor,
        paymentLock,
        qrPayment,
        merchantName,
        pixKeyLabel,
        methodIcon,
        currency,
        currencyAmount,
        amount,
        setAmount,
        usdAmount,
        errorMessage,
        errorInitiatingPayment,
        isBlockingError,
        balanceErrorMessage,
        shouldBlockPay,
        isLoading,
        payQR,
        handleCurrencyAmountChange,
        balance,
    } = useQrPayFlow()
    const { openSupportWithMessage: openSupportForLimits } = useModalsContext()

    // Live card-vs-local-rail markup — same cache entry the success screen's
    // savings message reads, so the two stay in sync.
    const { data: cardMarkup } = useCardMarkupRate(currency?.code, currency?.price)

    // validate payment against user's limits
    // currency comes from payment lock — hook normalizes it internally
    const limitsValidation = useLimitsValidation({
        flowType: 'qr-payment',
        amount: usdAmount,
        currency: currency?.code,
    })

    // BR self-service limit increase flow
    const { mantecaLimits: qrMantecaLimits, refetch: refetchQrLimits } = useLimits()
    const isBrQrEligible = isBrUserEligibleForLimitIncrease(qrMantecaLimits)
    const qrLimitIncreaseFlow = useSumsubActionFlow({
        fetchToken: initiateIncreaseLimits,
        onSuccess: refetchQrLimits,
        onNeedsSupport: () => openSupportForLimits('Hi, I would like to increase my payment limits.'),
    })

    // The LOADING view precedes FORM in the precedence ladder, so currency is
    // always set here — the guard only carries that fact to the type level.
    if (!currency) return null

    return (
        <>
            <SumsubKycWrapper
                visible={qrLimitIncreaseFlow.showWrapper}
                accessToken={qrLimitIncreaseFlow.accessToken}
                onClose={qrLimitIncreaseFlow.handleClose}
                onComplete={qrLimitIncreaseFlow.handleSdkComplete}
                onRefreshToken={qrLimitIncreaseFlow.refreshToken}
                isMultiLevel
            />
            <PageStack>
                <NavHeader title={tNav('pay')} />

                {/* Payment Content */}
                <PageStack.Center className="gap-4">
                    {/* Merchant Card */}
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-shrink-0 items-center justify-center rounded-full bg-white">
                                <Image
                                    src={methodIcon}
                                    alt={t('paymentMethodAlt')}
                                    width={48}
                                    height={48}
                                    className="h-12 w-12 rounded-full object-cover"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-1 text-center text-body-s">
                                    <Icon name="arrow-up-right" size={16} /> {t('youArePaying')}
                                </p>
                                <p
                                    className={`text-heading-xs break-words ${pixKeyLabel ? 'ph-mask ph-no-capture' : ''}`}
                                >
                                    {merchantName}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Amount Card */}
                    {currency && (
                        <div className="flex flex-col gap-1">
                            <AmountInput
                                initialAmount={currencyAmount}
                                setPrimaryAmount={handleCurrencyAmountChange}
                                primaryDenomination={{
                                    symbol: currency.symbol,
                                    price: currency.price,
                                    decimals: 2,
                                }}
                                secondaryDenomination={{
                                    symbol: 'USD',
                                    price: 1,
                                    decimals: 2,
                                }}
                                setSecondaryAmount={setAmount}
                                disabled={
                                    !!qrPayment ||
                                    isLoading ||
                                    (paymentProcessor === 'MANTECA' && paymentLock?.code !== '')
                                }
                                walletBalance={balance ? formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS) : undefined}
                                hideBalance
                            />
                            {/* only show balance error if limits blocking card is not displayed (warnings can coexist) */}
                            {balanceErrorMessage && !limitsValidation.isBlocking && (
                                <FieldError data-testid="error-alert">{balanceErrorMessage}</FieldError>
                            )}
                        </div>
                    )}

                    {/* Limits Warning/Error Card */}
                    {(() => {
                        const limitsCardProps = getLimitsWarningCardProps({
                            validation: limitsValidation,
                            flowType: 'qr-payment',
                            currency: limitsValidation.currency,
                        })
                        if (!limitsCardProps) return null
                        return (
                            <LimitsWarningCard
                                {...limitsCardProps}
                                onIncreaseLimits={
                                    isBrQrEligible && limitsValidation.isBlocking
                                        ? qrLimitIncreaseFlow.handleInitiate
                                        : undefined
                                }
                                isIncreaseLimitsLoading={qrLimitIncreaseFlow.isLoading}
                            />
                        )
                    })()}

                    {/* Information Card */}
                    <GlobalCard className="px-4">
                        <PaymentInfoRow
                            label={t('info.exchangeRate')}
                            value={`1 USD = ${currency.price} ${currency.code.toUpperCase()}`}
                            moreInfoText={t('info.exchangeRateTooltip', { currency: currency?.code ?? '' })}
                        />
                        {(() => {
                            if (!hasCardMarkupComparison(currency.code)) return null
                            const savingsInCents = calculateSavingsInCents(usdAmount, cardMarkup?.rate)
                            if (savingsInCents <= 0) return null
                            const savingsUsd = (savingsInCents / 100).toFixed(2)
                            return (
                                <PaymentInfoRow
                                    label={t('info.saveVsCard')}
                                    value={`~$${savingsUsd}`}
                                    moreInfoText={
                                        currency.code.toUpperCase() === 'BRL'
                                            ? t('info.saveVsCardTooltipBrl')
                                            : t('info.saveVsCardTooltipArs')
                                    }
                                />
                            )
                        })()}
                        <PaymentInfoRow
                            label={tCommon('peanutFee')}
                            value={tCommon('sponsoredByPeanut')}
                            hideBottomBorder
                        />
                    </GlobalCard>

                    {/* Send Button */}
                    <Button
                        onClick={payQR}
                        shadowSize="4"
                        loading={isLoading}
                        disabled={
                            !!errorInitiatingPayment ||
                            isBlockingError ||
                            !amount ||
                            isLoading ||
                            !!balanceErrorMessage ||
                            shouldBlockPay ||
                            !usdAmount ||
                            usdAmount === '0.00' ||
                            limitsValidation.isBlocking
                        }
                    >
                        {isLoading ? tCommon('loading') : tNav('pay')}
                    </Button>

                    {/* Error State */}
                    {errorMessage && (
                        <Callout priority="error" data-testid="error-alert">
                            {errorMessage}
                        </Callout>
                    )}
                </PageStack.Center>
            </PageStack>
        </>
    )
}

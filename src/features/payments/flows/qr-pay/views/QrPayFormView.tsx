'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { formatUnits } from 'viem'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import Card from '@/components/Global/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { Notification } from '@/components/0_Bruddle/Notification'
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
import { useWallet } from '@/hooks/wallet/useWallet'
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
    } = useQrPayFlow()
    const { spendableBalance: balance } = useWallet()
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
            <div className="flex min-h-inherit flex-col gap-8">
                <NavHeader title={tNav('pay')} />

                {/* Payment Content */}
                <div className="my-auto space-y-4 flex h-full flex-col justify-center">
                    {/* Merchant Card */}
                    <Card className="p-4">
                        <div className="space-x-3 flex items-center">
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
                                    <Icon name="arrow-up-right" size={10} /> {t('youArePaying')}
                                </p>
                                <p className="text-heading-xs break-words">{merchantName}</p>
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
                    <Card className="space-y-0 px-4">
                        <PaymentInfoRow
                            label={t('info.exchangeRate')}
                            value={`1 USD = ${currency.price} ${currency.code.toUpperCase()}`}
                            moreInfoText={t('info.exchangeRateTooltip')}
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
                    </Card>

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
                        <Notification priority="error" data-testid="error-alert">
                            {errorMessage}
                        </Notification>
                    )}
                </div>
            </div>
        </>
    )
}

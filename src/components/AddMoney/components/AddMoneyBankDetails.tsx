'use client'

import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import ShareButton from '@/components/Global/ShareButton'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { useRouter, useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo } from 'react'
import { countryData } from '@/components/AddMoney/consts'
import { formatCurrencyAmount } from '@/utils/currency'
import { formatBankAccountDisplay, shortDepositReference } from '@/utils/format.utils'
import { applyBridgeCrossCurrencyFee, getCurrencyConfig, getCurrencySymbol } from '@/utils/bridge.utils'
import { RequestFulfillmentBankFlowStep, useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import { formatAmount } from '@/utils/general.utils'
import InfoCard from '@/components/Global/InfoCard'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { resolveBridgeAccountHolderName } from '@/constants/payment.consts'
import { Button } from '@/components/0_Bruddle/Button'
import { useOnrampQuote } from '@/hooks/useOnrampQuote'
import { currencyToAccountType } from '@/utils/bridge.utils'
import { useQueryState, parseAsString } from 'nuqs'
import { useTranslations } from 'next-intl'

/**
 * TODO(architecture): Quote math is computed client-side instead of trusting backend.
 *
 * This file (and ExchangeRate component, MantecaDepositShareDetails, etc.) each
 * re-derive "amount user will receive" by multiplying raw exchange rate by amount.
 * This caused a production bug where UI promised more than Bridge actually delivered
 * because the 0.5% developer fee was not baked into the displayed rate.
 *
 * PROPER FIX: Add backend /bridge/onramp/quote and /bridge/offramp/quote endpoints
 * that return { gross, fee, net, exchangeRate }. UI displays `net`. This makes fee
 * changes propagate automatically and eliminates this whole class of bugs.
 *
 * Related: backend BRIDGE_DEVELOPER_FEE_PERCENT constant in peanut-api-ts must be
 * kept in sync manually with BRIDGE_DEVELOPER_FEE_RATE in payment.consts.ts.
 * A shared types package / OpenAPI spec would enforce this at compile time.
 *
 * See PR description of fix/bridge-fee-display-quote for full writeup.
 */

// add-money flow requires onBack (parent owns step navigation, typically
// setUrlState({ step: 'inputAmount' })). request-fulfillment steps back internally via
// RequestFulfillmentFlowContext.
type AddMoneyBankDetailsProps =
    | { flow?: 'add-money'; onBack: () => void }
    | { flow: 'request-fulfillment'; onBack?: never }

export default function AddMoneyBankDetails(props: AddMoneyBankDetailsProps) {
    const { flow = 'add-money' } = props
    const isAddMoneyFlow = flow === 'add-money'
    const t = useTranslations('addMoney')
    const tCommon = useTranslations('common')

    // URL state - read amount from URL query params
    const [amountFromUrl] = useQueryState('amount', parseAsString)

    // contexts
    const onrampContext = useOnrampFlow()
    const {
        setFlowStep: setRequestFulfilmentBankFlowStep,
        onrampData: requestFulfilmentOnrampData,
        selectedCountry: requestFulfilmentSelectedCountry,
    } = useRequestFulfillmentFlow()

    // routing and country context
    const router = useRouter()
    const params = useParams()
    const currentCountryName = params.country as string

    // get country information from url params or request fulfillment context
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

        // check if we're on the static us route by examining the current pathname
        if (typeof window !== 'undefined' && window.location.pathname.includes('/add-money/us/bank')) {
            return countryData.find((c) => c.id === 'US')
        }

        // default to us if no country is detected
        return countryData.find((c) => c.id === 'US')
    }, [isAddMoneyFlow, requestFulfilmentSelectedCountry, currentCountryName])

    // derive onramp currency once and reuse consistently
    const onrampCurrency = getCurrencyConfig(currentCountryDetails?.id || 'US', 'onramp').currency

    // Onramp quote returns the net rate (after Peanut's 50bps developer
    // fee), so `sourceAmount * exchangeRate` projects the real USDC the
    // user will receive — matching the "Recipient Gets" figure on bridge
    // offramp + ExchangeRateWidget.
    const { netRate: exchangeRate, isLoading: isLoadingExchangeRate } = useOnrampQuote({
        accountType: currencyToAccountType(onrampCurrency),
        enabled: true,
    })

    // data from URL state (add-money flow) or context (request-fulfillment flow)
    // For add-money flow, amount is now in URL state via nuqs
    const amount = isAddMoneyFlow ? (amountFromUrl ?? '') : requestFulfilmentOnrampData?.depositInstructions?.amount
    const onrampData = isAddMoneyFlow ? onrampContext.onrampData : requestFulfilmentOnrampData

    const currencySymbolBasedOnCountry = useMemo(() => {
        // symbol of the detected onramp currency (e.g., €, $)
        return getCurrencySymbol(onrampCurrency)
    }, [onrampCurrency])

    // usd symbol for displaying approximate amount in usd
    const usdCurrencySymbol = useMemo(() => {
        return getCurrencySymbol('USD')
    }, [])

    const isNonUsdCurrency = useMemo(() => {
        // true when deposit currency is not usd
        return onrampCurrency.toLowerCase() !== 'usd'
    }, [onrampCurrency])

    // safely parse user-entered amounts that may contain grouping separators like commas
    const parseAmountToNumber = useCallback((rawAmount: string): number | null => {
        // remove common grouping separators and spaces
        const normalized = (rawAmount ?? '').replace(/[\s,]/g, '')
        const parsed = Number.parseFloat(normalized)
        if (Number.isNaN(parsed)) return null
        return parsed
    }, [])

    const amountBasedOnCurrencyExchangeRate = useCallback(
        (amount: string) => {
            if (!exchangeRate) return amount
            const baseAmount = parseAmountToNumber(amount)
            if (baseAmount === null) return amount
            if (isNonUsdCurrency) {
                // for non-usd deposits, show the approximate amount in usd
                // bake in the 0.5% Bridge developer fee so displayed amount matches
                // what Bridge actually delivers (applyBridgeCrossCurrencyFee is a no-op for USD)
                const grossUsd = baseAmount * exchangeRate
                // NOTE: pass 'USDC' (the real Bridge destination) not 'USD' — the helper
                // mirrors backend `getBridgeDeveloperFeeParams` which treats 'usd' as the
                // fiat rail (fee-free USD↔USDC) and 'usdc' as the stablecoin. The "$" shown
                // to the user is just display; the on-chain transfer is EUR/GBP/MXN → USDC.
                const netUsd = applyBridgeCrossCurrencyFee(grossUsd, onrampCurrency, 'USDC')
                return '≈ ' + usdCurrencySymbol + ' ' + formatAmount(netUsd)
            }
            return '≈ ' + currencySymbolBasedOnCountry + ' ' + formatAmount(baseAmount * exchangeRate)
        },
        [
            exchangeRate,
            isNonUsdCurrency,
            usdCurrencySymbol,
            currencySymbolBasedOnCountry,
            parseAmountToNumber,
            onrampCurrency,
        ]
    )

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

        return formatCurrencyAmount(amount, onrampCurrency)
    }, [amount, onrampCurrency, flow])

    const isUk = currentCountryDetails?.id === 'GB' || currentCountryDetails?.iso3 === 'GBR'

    const generateBankDetails = async () => {
        const formattedAmount = formattedCurrencyAmount
        const isMexico = currentCountryDetails?.id === 'MX'
        const isUs = currentCountryDetails?.id === 'US'
        const loading = tCommon('loading')
        const line = (label: string, value: string) => t('bankDetails.shareLine', { label, value })

        const lines: string[] = [
            t('bankDetails.shareIntro'),
            line(t('bankDetails.amountLabel'), formattedAmount),
            line(t('bankDetails.bankName'), onrampData?.depositInstructions?.bankName || loading),
        ]

        if (isUs) {
            lines.push(
                line(t('bankDetails.beneficiaryName'), String(onrampData?.depositInstructions?.bankBeneficiaryName)),
                line(
                    t('bankDetails.beneficiaryAddress'),
                    String(onrampData?.depositInstructions?.bankBeneficiaryAddress)
                )
            )
        }

        if (!isUs && !isMexico && !isUk) {
            lines.push(
                line(t('bankDetails.accountHolderName'), String(onrampData?.depositInstructions?.accountHolderName))
            )
        }

        // for mexico, include clabe
        if (isMexico) {
            lines.push(
                line(t('bankDetails.accountHolderName'), String(onrampData?.depositInstructions?.accountHolderName)),
                line(t('bankDetails.clabe'), onrampData?.depositInstructions?.clabe || loading)
            )
        }

        // uk faster payments
        if (isUk) {
            lines.push(
                line(t('bankDetails.sortCode'), onrampData?.depositInstructions?.sortCode || loading),
                line(t('bankDetails.accountNumber'), onrampData?.depositInstructions?.accountNumber || loading)
            )
        }

        // us and sepa countries
        if (!isMexico && !isUk) {
            lines.push(line(t('bankDetails.bankAddress'), onrampData?.depositInstructions?.bankAddress || loading))

            const accountLabel = onrampData?.depositInstructions?.bankAccountNumber
                ? t('bankDetails.accountNumber')
                : t('bankDetails.iban')
            const routingLabel = onrampData?.depositInstructions?.bankRoutingNumber
                ? t('bankDetails.routingNumber')
                : t('bankDetails.bic')
            const accountValue =
                onrampData?.depositInstructions?.bankAccountNumber ||
                (onrampData?.depositInstructions?.iban
                    ? formatBankAccountDisplay(onrampData.depositInstructions.iban, 'iban')
                    : null) ||
                loading
            const routingValue =
                onrampData?.depositInstructions?.bankRoutingNumber || onrampData?.depositInstructions?.bic || loading

            lines.push(line(accountLabel, accountValue), line(routingLabel, routingValue))
        }

        lines.push(
            line(
                t('bankDetails.depositReference'),
                shortDepositReference(onrampData?.depositInstructions?.depositMessage) || loading
            ),
            '',
            t('bankDetails.shareOutro')
        )

        return lines.join('\n')
    }

    const handleBack = () => {
        if (props.flow === 'request-fulfillment') {
            setRequestFulfilmentBankFlowStep(RequestFulfillmentBankFlowStep.BankCountryList)
        } else {
            props.onBack()
        }
    }

    if (!amount) {
        return null
    }

    return (
        <div className="flex h-full w-full flex-col justify-start gap-8 self-start">
            <NavHeader title={t('transferDetails')} onPrev={handleBack} />

            <div className="my-auto flex h-full w-full flex-col justify-center space-y-4 pb-5">
                <Card className="p-4">
                    <p className="text-xs font-normal text-gray-1">{t('bankDetails.amountToSend')}</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-extrabold text-black md:text-4xl">{formattedCurrencyAmount}</p>
                        <CopyToClipboard textToCopy={formattedCurrencyAmount} fill="black" iconSize="4" />
                    </div>

                    <InfoCard
                        variant="warning"
                        className="mt-4"
                        icon="alert"
                        description={t('bankDetails.sendExactAmount')}
                    />
                </Card>

                <Card className="p-4">
                    <p className="text-xs font-normal text-gray-1">{t('bankDetails.depositReference')}</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-xl font-extrabold text-black md:text-4xl">
                            {shortDepositReference(onrampData?.depositInstructions?.depositMessage) ||
                                tCommon('loading')}
                        </p>
                        {onrampData?.depositInstructions?.depositMessage && (
                            <CopyToClipboard
                                textToCopy={shortDepositReference(onrampData.depositInstructions.depositMessage)}
                                fill="black"
                                iconSize="4"
                            />
                        )}
                    </div>

                    <InfoCard
                        variant="warning"
                        className="mt-4"
                        icon="alert"
                        description={t('bankDetails.pasteInReferenceField')}
                    />
                </Card>

                <Card className="gap-2 rounded-sm">
                    <h1 className="text-xs">{t('bankDetails.title')}</h1>

                    {/* resolveBridgeAccountHolderName maps Bridge's stale/absent legal entity name to the current one (Sp. Z.o.o. -> S.A.) */}
                    <PaymentInfoRow
                        label={t('bankDetails.accountHolderName')}
                        value={resolveBridgeAccountHolderName(onrampData?.depositInstructions?.accountHolderName)}
                        allowCopy
                        hideBottomBorder
                    />

                    <PaymentInfoRow
                        label={t('bankDetails.bankName')}
                        value={onrampData?.depositInstructions?.bankName || tCommon('loading')}
                        allowCopy={!!onrampData?.depositInstructions?.bankName}
                        hideBottomBorder
                    />
                    {currentCountryDetails?.id !== 'MX' && (
                        <PaymentInfoRow
                            label={t('bankDetails.bankAddress')}
                            value={onrampData?.depositInstructions?.bankAddress || tCommon('loading')}
                            allowCopy={!!onrampData?.depositInstructions?.bankAddress}
                            hideBottomBorder
                        />
                    )}

                    {onrampData?.depositInstructions?.bankBeneficiaryName && (
                        <PaymentInfoRow
                            label={t('bankDetails.beneficiaryName')}
                            value={onrampData?.depositInstructions?.bankBeneficiaryName || tCommon('loading')}
                            allowCopy={!!onrampData?.depositInstructions?.bankBeneficiaryName}
                            hideBottomBorder
                        />
                    )}

                    {onrampData?.depositInstructions?.bankBeneficiaryAddress && (
                        <PaymentInfoRow
                            label={t('bankDetails.beneficiaryAddress')}
                            value={onrampData?.depositInstructions?.bankBeneficiaryAddress || tCommon('loading')}
                            allowCopy={!!onrampData?.depositInstructions?.bankBeneficiaryAddress}
                            hideBottomBorder
                        />
                    )}

                    {currentCountryDetails?.id === 'MX' ? (
                        <PaymentInfoRow
                            label={t('bankDetails.clabe')}
                            value={onrampData?.depositInstructions?.clabe || 'N/A'}
                            allowCopy={!!onrampData?.depositInstructions?.clabe}
                            hideBottomBorder
                        />
                    ) : isUk ? (
                        <>
                            <PaymentInfoRow
                                label={t('bankDetails.sortCode')}
                                value={onrampData?.depositInstructions?.sortCode || 'N/A'}
                                allowCopy={!!onrampData?.depositInstructions?.sortCode}
                                hideBottomBorder
                            />
                            <PaymentInfoRow
                                label={t('bankDetails.accountNumber')}
                                value={onrampData?.depositInstructions?.accountNumber || 'N/A'}
                                allowCopy={!!onrampData?.depositInstructions?.accountNumber}
                                hideBottomBorder
                            />
                        </>
                    ) : (
                        <>
                            <PaymentInfoRow
                                label={
                                    onrampData?.depositInstructions?.bankAccountNumber
                                        ? t('bankDetails.accountNumber')
                                        : t('bankDetails.iban')
                                }
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
                            <PaymentInfoRow
                                label={
                                    onrampData?.depositInstructions?.bankRoutingNumber
                                        ? t('bankDetails.routingNumber')
                                        : t('bankDetails.bic')
                                }
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
                        </>
                    )}
                    {isNonUsdCurrency && (
                        <PaymentInfoRow
                            loading={isLoadingExchangeRate}
                            label={t('bankDetails.youllReceive')}
                            value={`${amountBasedOnCurrencyExchangeRate(amount)}`}
                            allowCopy={false}
                            hideBottomBorder={true}
                        />
                    )}
                </Card>

                <InfoCard
                    variant="warning"
                    icon="alert"
                    title={t('bankDetails.doubleCheckTitle')}
                    items={[
                        t('bankDetails.doubleCheckAmount', { amount: formattedCurrencyAmount }),
                        t('bankDetails.doubleCheckReference', {
                            reference:
                                shortDepositReference(onrampData?.depositInstructions?.depositMessage) ||
                                tCommon('loading'),
                        }),
                        // name mismatch is the top cause of returned deposits (Bridge BE01). the
                        // own-name rule holds for ACH/SEPA/wire; MX SPEI supports paying from a
                        // third-party/client account, so this item is omitted there.
                        ...(currentCountryDetails?.id !== 'MX'
                            ? [t('bankDetails.doubleCheckSenderName'), t('bankDetails.doubleCheckRecipientName')]
                            : []),
                    ]}
                />

                <Button onClick={() => router.push('/home')} variant="purple" className="w-full" shadowSize="4">
                    {t('bankDetails.sentTransfer')}
                </Button>

                <ShareButton
                    generateText={generateBankDetails}
                    title={t('bankDetails.shareTitle')}
                    variant="primary-soft"
                    className="w-full"
                >
                    {t('bankDetails.shareDetails')}
                </ShareButton>
            </div>
        </div>
    )
}

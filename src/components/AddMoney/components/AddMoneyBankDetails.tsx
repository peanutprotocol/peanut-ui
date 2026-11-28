'use client'

import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import ShareButton from '@/components/Global/ShareButton'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { useRouter, useParams } from 'next/navigation'
import { useReturnTo } from '@/hooks/useSafeBack'
import { useCallback, useEffect, useMemo } from 'react'
import { countryData } from '@/components/AddMoney/consts'
import { formatAmountNumber, formatBankAmount } from '@/utils/currency'
import { shortDepositReference } from '@/utils/format.utils'
import { applyBridgeCrossCurrencyFee, getCurrencySymbol } from '@/utils/bridge.utils'
import { bankDepositAccountRows, bankDepositCurrency, bankDepositRail } from '@/utils/bank-deposit.utils'
import { bankPayoutMinimum } from '@/features/withdraw/amount-validation'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { Callout } from '@/components/0_Bruddle/Callout'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { resolveBridgeAccountHolderName } from '@/constants/payment.consts'
import { Button } from '@/components/0_Bruddle/Button'
import { useOnrampQuote } from '@/hooks/useOnrampQuote'
import { currencyToAccountType } from '@/utils/bridge.utils'
import { useQueryState, parseAsString } from 'nuqs'
import { useTranslations } from 'next-intl'
import { useHistoryEntry } from '@/hooks/useHistoryEntry'
import { historyEntryPhase, useDepositSuccessEntry } from '@/features/add-money/useDepositSuccessEntry'
import { BankDepositSuccessView } from '@/features/add-money/components/BankDepositSuccessView'

/**
 * TODO(architecture): Quote math is computed client-side instead of trusting backend.
 *
 * This file (and ExchangeRate component, MantecaDepositShareDetails, etc.) each
 * re-derive "amount user will receive" by multiplying raw exchange rate by amount.
 * This caused a production bug where UI promised more than Bridge actually delivered
 * because the then-active 0.5% developer fee was not baked into the displayed rate.
 * (The fee has since been zeroed — BRIDGE_DEVELOPER_FEE_RATE = 0 — but the
 * client-side-derivation hazard this note describes remains.)
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

type AddMoneyBankDetailsProps = {
    onBack: () => void
}

export default function AddMoneyBankDetails({ onBack }: AddMoneyBankDetailsProps) {
    const t = useTranslations('addMoney')
    const tCommon = useTranslations('common')

    // URL state - read amount from URL query params
    const [rawReturnTo] = useQueryState(RETURN_TO_PARAM, parseAsString)
    const exitTarget = readReturnTo({ get: (key) => (key === RETURN_TO_PARAM ? rawReturnTo : null) }) ?? '/home'
    const [amountFromUrl] = useQueryState('amount', parseAsString)
    const [countryFromQuery] = useQueryState('country', parseAsString)

    // contexts
    const { onrampData } = useOnrampFlow()
    // no status route for a one-time transfer: its history entry is the signal, polled every 15 s while not final
    const transferId = onrampData?.transferId
    const { data: transferEntry } = useHistoryEntry(transferId, 'ONRAMP')
    const depositSuccess = useDepositSuccessEntry(transferId, historyEntryPhase(transferEntry))

    // routing and country context
    const router = useRouter()
    // rewinds to home past every entry the flow pushed; a replace kept the
    // earlier entries, so back from home re-entered the flow
    const leaveToHome = useReturnTo(exitTarget)
    const params = useParams()
    // Native routes keep the country in query state instead of a path segment.
    const currentCountryName = (params.country as string) || countryFromQuery || ''

    // get country information from url params
    const currentCountryDetails = useMemo(() => {
        // check if we have country params (from dynamic route)
        if (currentCountryName) {
            return countryData.find(
                (country) => country.type === 'country' && country.path === currentCountryName.toLowerCase()
            )
        }

        // default to us if no country is detected
        return countryData.find((c) => c.id === 'US')
    }, [currentCountryName])

    // The API's answer names the currency and carries the bank details, so it
    // decides which rows show; the country only stands in for an answer
    // without a currency (see bankDepositCurrency).
    const onrampCurrency = bankDepositCurrency(onrampData?.depositInstructions, currentCountryDetails?.id)
    const rail = bankDepositRail(onrampCurrency)
    const accountRows = bankDepositAccountRows(onrampData?.depositInstructions, rail)
    const isUk = rail === 'faster_payments'
    const isMexico = rail === 'spei'

    // Onramp quote returns the net deposit-side rate (Peanut's developer fee
    // is currently 0, so net === gross), so `sourceAmount * exchangeRate`
    // projects the real USDC the user will receive — matching the "Recipient
    // Gets" figure on bridge offramp + ExchangeRateWidget.
    const { netRate: exchangeRate, isLoading: isLoadingExchangeRate } = useOnrampQuote({
        accountType: currencyToAccountType(onrampCurrency),
        enabled: true,
    })

    // For add-money flow, amount is in URL state via nuqs
    const amount = amountFromUrl ?? ''
    // the backend decides the matching mode; only a flexible transfer may tell
    // the user that any amount works
    const isFlexibleAmount = onrampData?.flexibleAmount === true
    // flexible still has a floor: the rail does not credit a transfer below its
    // minimum. Bridge sets one minimum per currency for both directions, so the
    // payout rule is the deposit rule too, and it is the same number the
    // amount step validated against.
    const flexibleAmountMinimum = formatBankAmount(bankPayoutMinimum(onrampCurrency), onrampCurrency)

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
                // pass through the cross-currency fee helper (currently identity —
                // fee is 0; kept so a re-enabled FX margin propagates here)
                const grossUsd = baseAmount * exchangeRate
                // NOTE: pass 'USDC' (the real Bridge destination) not 'USD' — the helper
                // mirrors backend `getBridgeDeveloperFeeParams` which treats 'usd' as the
                // fiat rail (fee-free USD↔USDC) and 'usdc' as the stablecoin. The "$" shown
                // to the user is just display; the on-chain transfer is EUR/GBP/MXN → USDC.
                const netUsd = applyBridgeCrossCurrencyFee(grossUsd, onrampCurrency, 'USDC')
                return '≈ ' + usdCurrencySymbol + ' ' + formatAmountNumber(netUsd)
            }
            return '≈ ' + currencySymbolBasedOnCountry + ' ' + formatAmountNumber(baseAmount * exchangeRate)
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
        if (!amount || parseFloat(amount) <= 0) {
            router.replace('/add-money')
            return
        }
    }, [amount, router])

    const formattedCurrencyAmount = useMemo(() => {
        if (!amount) return ''

        return formatBankAmount(amount, onrampCurrency)
    }, [amount, onrampCurrency])

    const generateBankDetails = async () => {
        const formattedAmount = formattedCurrencyAmount
        const isUs = rail === 'ach'
        const loading = tCommon('loading')
        const line = (label: string, value: string) => t('bankDetails.shareLine', { label, value })

        const lines: string[] = [
            t('bankDetails.shareIntro'),
            line(t('bankDetails.amountLabel'), formattedAmount),
            line(t('bankDetails.bankName'), onrampData?.depositInstructions?.bankName || loading),
        ]

        if (isUs) {
            lines.push(
                line(t('bankDetails.beneficiaryName'), onrampData?.depositInstructions?.bankBeneficiaryName || loading),
                line(
                    t('bankDetails.beneficiaryAddress'),
                    onrampData?.depositInstructions?.bankBeneficiaryAddress || loading
                )
            )
        }

        if (!isUs && !isMexico && !isUk) {
            lines.push(
                line(t('bankDetails.accountHolderName'), onrampData?.depositInstructions?.accountHolderName || loading)
            )
        }

        if (isMexico) {
            lines.push(
                line(t('bankDetails.accountHolderName'), onrampData?.depositInstructions?.accountHolderName || loading)
            )
        }

        // us and sepa
        if (!isMexico && !isUk) {
            lines.push(line(t('bankDetails.bankAddress'), onrampData?.depositInstructions?.bankAddress || loading))
        }

        lines.push(...accountRows.map((row) => line(t(`bankDetails.${row.label}`), row.value || loading)))

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
        onBack()
    }

    if (!amount) {
        return null
    }

    if (depositSuccess) {
        return <BankDepositSuccessView entry={depositSuccess} redirectTo={exitTarget} />
    }

    return (
        <div className="flex h-full w-full flex-col justify-start gap-8 self-start">
            <NavHeader title={t('transferDetails')} onPrev={handleBack} />

            <div className="my-auto space-y-4 flex h-full w-full flex-col justify-center pb-4">
                <Card className="p-4">
                    <p className="text-body-xs text-foreground-secondary">
                        {isFlexibleAmount ? t('bankDetails.amountLabel') : t('bankDetails.amountToSend')}
                    </p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-heading-s text-foreground-primary md:text-heading-l">
                            {formattedCurrencyAmount}
                        </p>
                        <CopyToClipboard textToCopy={formattedCurrencyAmount} fill="black" iconSize="4" />
                    </div>

                    <Callout priority="attention" className="mt-4">
                        {isFlexibleAmount
                            ? t('bankDetails.sendAnyAmount', { minimum: flexibleAmountMinimum })
                            : t('bankDetails.sendExactAmount')}
                    </Callout>
                </Card>

                <Card className="p-4">
                    <p className="text-body-xs text-foreground-secondary">{t('bankDetails.depositReference')}</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-heading-xs text-foreground-primary md:text-heading-l">
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

                    <Callout priority="attention" className="mt-4">
                        {t('bankDetails.pasteInReferenceField')}
                    </Callout>
                </Card>

                <Card className="gap-2 rounded-sm">
                    <h1 className="text-label-m text-foreground-secondary">{t('bankDetails.title')}</h1>

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
                    {!isMexico && (
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

                    {accountRows.map((row) => (
                        <PaymentInfoRow
                            key={row.label}
                            label={t(`bankDetails.${row.label}`)}
                            value={row.value || 'N/A'}
                            allowCopy={!!row.value}
                            copyValue={row.copyValue}
                            hideBottomBorder
                        />
                    ))}
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

                <Callout priority="attention" hideIcon title={t('bankDetails.doubleCheckTitle')}>
                    <BulletList
                        items={[
                            ...(isFlexibleAmount
                                ? []
                                : [t('bankDetails.doubleCheckAmount', { amount: formattedCurrencyAmount })]),
                            t('bankDetails.doubleCheckReference', {
                                reference:
                                    shortDepositReference(onrampData?.depositInstructions?.depositMessage) ||
                                    tCommon('loading'),
                            }),
                            // name mismatch is the top cause of returned deposits (Bridge BE01). the
                            // own-name rule holds for ACH/SEPA/wire; MX SPEI supports paying from a
                            // third-party/client account, so this item is omitted there.
                            ...(!isMexico
                                ? [t('bankDetails.doubleCheckSenderName'), t('bankDetails.doubleCheckRecipientName')]
                                : []),
                        ]}
                    />
                </Callout>

                {/* Arrival expectation per rail: waiting for money with no ETA
                    is the classic support-ticket generator. Copy is honest about
                    the ceiling but leads with the typical case. */}
                <p className="mt-2 text-body-xs text-foreground-secondary">
                    {onrampCurrency === 'usd'
                        ? t('bankDetails.etaAch')
                        : onrampCurrency === 'mxn'
                          ? t('bankDetails.etaSpei')
                          : onrampCurrency === 'gbp'
                            ? t('bankDetails.etaFps')
                            : t('bankDetails.etaSepa')}
                </p>

                <Button onClick={leaveToHome} variant="primary" className="w-full" shadowSize="4">
                    {t('bankDetails.sentTransfer')}
                </Button>

                <ShareButton
                    generateText={generateBankDetails}
                    title={t('bankDetails.shareTitle')}
                    variant="secondary"
                    className="w-full"
                >
                    {t('bankDetails.shareDetails')}
                </ShareButton>
            </div>
        </div>
    )
}

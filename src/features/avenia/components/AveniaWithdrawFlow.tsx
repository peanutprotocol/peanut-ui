'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { formatUnits } from 'viem'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { Button } from '@/components/0_Bruddle/Button'
import { Field } from '@/components/0_Bruddle/Field'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import AmountInput from '@/components/Global/AmountInput'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import RateUnavailable from '@/components/Global/RateUnavailable'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { SYMBOLS_BY_CURRENCY_CODE } from '@/constants/currency-symbols.consts'
import {
    AVENIA_MIN_WITHDRAWAL_BRL,
    AVENIA_WITHDRAW_STEPS,
    aveniaWithdrawAmount,
    completePixKey,
} from '@/features/avenia/avenia.utils'
import { AveniaPixKeyStep } from '@/features/avenia/components/AveniaPixKeyStep'
import { AveniaPixSetup } from '@/features/avenia/components/AveniaPixSetup'
import { AveniaWithdrawOutcome } from '@/features/avenia/components/AveniaWithdrawOutcome'
import { AveniaWithdrawReview } from '@/features/avenia/components/AveniaWithdrawReview'
import { useAveniaRefusalMessage } from '@/features/avenia/hooks/useAveniaRefusalMessage'
import { useAveniaWithdrawSubmit } from '@/features/avenia/hooks/useAveniaWithdrawSubmit'
import { WITHDRAW_BACK_FALLBACK_URL } from '@/features/withdraw/routes'
import { useWithdrawAmount, useWithdrawDestinationAmount } from '@/features/withdraw/useWithdrawAmount'
import { usePixQuoteCurrency } from '@/features/pix/usePixQuoteCurrency'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { useWallet } from '@/hooks/wallet/useWallet'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { aveniaApi } from '@/services/avenia'
import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import type { CapabilityRoute } from '@/types/capabilities'
import { isAmountWithinBalance } from '@/utils/balance.utils'
import { formatBankAmount } from '@/utils/currency'

/**
 * Withdraw by Pix for a Brazilian resident on Avenia: the own Pix key, the
 * amount, the review, then the signature. The key and the amount live in the
 * URL (`?destination=`, `?amount=` in USD, `?destinationAmount=` in reais or
 * `?spend=` for the whole balance), so a refresh keeps the step; nothing is
 * opened at Avenia before Confirm.
 */
export function AveniaWithdrawFlow({ route }: { route: CapabilityRoute }) {
    const t = useTranslations('avenia.withdraw')
    const tShared = useTranslations('avenia')
    const refusalMessage = useAveniaRefusalMessage()
    const tWithdraw = useTranslations('withdraw')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const tErrors = useTranslations('errors')
    const router = useRouter()
    const { isFromSendFlow } = useSendFlowOrigin()
    const title = tNav(isFromSendFlow ? 'send' : 'withdraw')
    const backToWithdraw = useSafeBack(WITHDRAW_BACK_FALLBACK_URL)
    const leaveFlow = () => (isFromSendFlow ? router.replace('/send') : backToWithdraw())

    const [destination, setDestination] = useQueryState('destination', parseAsString.withDefault(''))
    // set once Confirm opened the withdrawal: from then on the URL shows its outcome, never the form again
    const [intentId, setIntentId] = useQueryState('intentId', parseAsString.withDefault(''))
    const [amountUsd, setAmountUsd] = useWithdrawAmount()
    const [amountBrl, setAmountBrl] = useWithdrawDestinationAmount()
    // "Use balance": the USDC that leaves the wallet, Rhino's fee included, so the whole balance can go
    const [spendUsd, setSpendUsd] = useQueryState('spend', parseAsString.withDefault(''))
    const pixKey = completePixKey(destination)
    const amount = aveniaWithdrawAmount({ amountUsd, amountBrl, spendUsd })
    const submit = useAveniaWithdrawSubmit({
        // From the open ticket on, the URL names the withdrawal, not the form: step and intentId
        // only. The key and the amount live in the ticket, and a reload reads its outcome.
        onOpened: (id) => {
            void setIntentId(id)
            void setDestination(null)
            void setAmountUsd(null)
            void setAmountBrl(null)
            void setSpendUsd(null)
        },
    })
    const { hasPendingTransactions } = usePendingTransactions()

    const stepper = useFlowStepper({
        steps: AVENIA_WITHDRAW_STEPS,
        guards: {
            amount: { ok: !!pixKey, fallback: 'pix-key' },
            // an opened withdrawal stays on its review: the URL then holds only its id
            review: { ok: (!!pixKey && !!amount) || !!intentId, fallback: pixKey ? 'amount' : 'pix-key' },
            success: { ok: !!intentId },
        },
    })
    const step = stepper.step
    const { goTo } = stepper
    const isSent = submit.phase === 'funded' || submit.phase === 'unconfirmed'
    // The deposit was sent, or the page reloaded after Confirm opened the withdrawal (the
    // signature is gone with the memory): the last step is the only way on.
    const showOutcome = !!intentId && (isSent || !submit.opened)
    useEffect(() => {
        if (showOutcome && step !== 'success') void goTo('success')
    }, [showOutcome, step, goTo])

    const request = pixKey && amount ? { pixKey, ...amount } : null
    const preview = useQuery({
        queryKey: ['avenia-withdraw-preview', request],
        queryFn: () => aveniaApi.previewWithdrawal(request!),
        // the review shows it; once Confirm opened the ticket (`?intentId=`), the confirmed numbers stand
        enabled: step === 'review' && !!request && !intentId && !submit.lockedAfterInit,
        retry: false,
        staleTime: 30_000,
    })

    const { spendableBalance, formattedSpendableBalance, spendableBalanceDecimal } = useWallet()
    const [typedBrl, setTypedBrl] = useState<string | undefined>(undefined)
    // the amount step's estimate is Avenia's quote for the reais on screen, not the /fx rate
    // only the amount step quotes: the setup, key, review and last steps do not
    const brl = usePixQuoteCurrency(
        'withdraw',
        typedBrl,
        AVENIA_MIN_WITHDRAWAL_BRL,
        route.state === 'ready' && step === 'amount' && !showOutcome
    )
    const [typedUsd, setTypedUsd] = useState<string | undefined>(undefined)
    const [enteredIn, setEnteredIn] = useState<'local' | 'usd' | 'balance'>(
        amountBrl ? 'local' : spendUsd ? 'balance' : 'usd'
    )
    const seedBrl = useMemo(() => {
        if (amountBrl) return amountBrl
        const usd = Number(spendUsd || amountUsd)
        return usd > 0 && brl.price ? (usd * brl.price.sell).toFixed(2) : undefined
    }, [amountBrl, amountUsd, spendUsd, brl.price])

    if (showOutcome) {
        return (
            <AveniaWithdrawOutcome
                title={title}
                intentId={intentId}
                // nothing left the wallet: the same key and amount, quoted again
                // nothing left the wallet: a new withdrawal, from its key (the URL dropped the old form)
                onStartAgain={() => {
                    void setIntentId(null)
                    void stepper.goTo('pix-key')
                }}
                sent={
                    isSent && submit.opened
                        ? {
                              phase: submit.phase === 'funded' ? 'funded' : 'unconfirmed',
                              display: submit.opened.display,
                          }
                        : null
                }
            />
        )
    }

    if (route.state !== 'ready') return <AveniaPixSetup title={title} onBack={leaveFlow} route={route} />

    if (step === 'pix-key') {
        return (
            <AveniaPixKeyStep
                title={title}
                initialKey={destination}
                onBack={leaveFlow}
                onContinue={(key) => {
                    void setDestination(key)
                    void stepper.goTo('amount')
                }}
            />
        )
    }

    if (step === 'amount') {
        const usdForBalance = typedUsd ?? amountUsd
        const balanceError =
            usdForBalance && Number(usdForBalance) > 0 && !isAmountWithinBalance(usdForBalance, spendableBalance)
                ? tErrors('insufficientBalance')
                : undefined
        // the reais the field shows, typed or converted; the API checks the credited amount again
        const belowMinimum = Number(typedBrl) > 0 && Number(typedBrl) < AVENIA_MIN_WITHDRAWAL_BRL
        const amountError =
            balanceError ??
            (belowMinimum
                ? tShared('deposit.minimum', { amount: formatBankAmount(AVENIA_MIN_WITHDRAWAL_BRL, 'BRL') })
                : undefined)
        return (
            <PageStack>
                <NavHeader title={title} onPrev={() => void stepper.goTo('pix-key')} />
                <PageStack.Center>
                    <div className="text-heading-xs text-foreground-primary">{tWithdraw('amountToWithdraw')}</div>
                    {/* the quote failed (the route changed, Avenia is down): retry here, not a spinner */}
                    {brl.isError ? (
                        <RateUnavailable onRetry={brl.refetch} />
                    ) : brl.isLoading || !brl.price ? (
                        <Loading />
                    ) : (
                        <Field error={amountError}>
                            <AmountInput
                                initialAmount={seedBrl}
                                setPrimaryAmount={setTypedBrl}
                                setSecondaryAmount={setTypedUsd}
                                // R$, as the deposit amount and the review show reais
                                primaryDenomination={{
                                    symbol: SYMBOLS_BY_CURRENCY_CODE.BRL,
                                    price: brl.price.sell,
                                    decimals: 2,
                                }}
                                secondaryDenomination={{ symbol: 'USD', price: 1, decimals: 2 }}
                                onBalanceFilled={() => setEnteredIn('balance')}
                                onAmountTyped={(symbol) =>
                                    setEnteredIn(symbol.toUpperCase() === 'USD' ? 'usd' : 'local')
                                }
                                walletBalance={spendableBalance !== undefined ? formattedSpendableBalance : undefined}
                                balanceFillAmount={
                                    spendableBalanceDecimal !== undefined
                                        ? spendableBalanceDecimal * brl.price.sell
                                        : undefined
                                }
                            />
                        </Field>
                    )}
                    <Button
                        variant="primary"
                        className="w-full"
                        disabled={!Number(typedUsd) || !!amountError || brl.isError}
                        onClick={() => {
                            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_AMOUNT_ENTERED, {
                                amount_usd: typedUsd,
                                method_type: 'avenia',
                                country: 'brazil',
                            })
                            // the API takes one amount: the one the user typed, or the balance they tapped
                            const balanceUsd =
                                enteredIn === 'balance' && spendableBalance !== undefined
                                    ? formatUnits(spendableBalance, PEANUT_WALLET_TOKEN_DECIMALS)
                                    : null
                            const typedLocal = enteredIn === 'local' && typedBrl ? typedBrl : null
                            void setSpendUsd(balanceUsd)
                            void setAmountBrl(balanceUsd ? null : typedLocal)
                            void setAmountUsd(balanceUsd || typedLocal ? null : (typedUsd ?? null))
                            void stepper.goTo('review')
                        }}
                    >
                        {tCommon('continue')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

    // once Confirm opened the ticket, its own numbers are the ones the wallet signs
    const display = submit.opened?.display ?? preview.data ?? null
    const reconfirm = submit.phase === 'reconfirm'
    const fundsShort = !!display && !isAmountWithinBalance(display.withdrawUsd, spendableBalance)
    // each refusal offers the one step that can change it
    const previewAction = (code: string | undefined) => {
        // a smaller amount can pass the monthly limit; the key stays
        if (code === API_ERROR_CODES.PIX_LIMIT_EXCEEDED)
            return { label: t('changeAmount'), onClick: () => void stepper.goTo('amount') }
        // withdrawals still on their way: only time helps, and the message says so
        if (code === API_ERROR_CODES.WITHDRAWAL_IN_PROGRESS) return undefined
        return { label: tCommon('retry'), onClick: () => void preview.refetch() }
    }
    const reviewError = submit.error
        ? // once Avenia's ticket is open, only a signature that surely sent nothing may be tried again
          {
              message:
                  submit.lockedAfterInit && !submit.canSignOpened
                      ? `${submit.error} ${t('errors.afterInit')}`
                      : submit.error,
          }
        : preview.error
          ? { message: refusalMessage(preview.error), action: previewAction(wireErrorCode(preview.error)) }
          : fundsShort
            ? { message: tErrors('insufficientBalance') }
            : reconfirm
              ? { message: t('quoteMoved'), priority: 'attention' as const }
              : null

    return (
        <AveniaWithdrawReview
            title={title}
            display={display}
            isLoading={preview.isLoading}
            isSubmitting={submit.phase === 'starting' || submit.phase === 'signing'}
            error={reviewError}
            canConfirm={
                !!display &&
                !fundsShort &&
                // another balance-decreasing send is still in flight
                !hasPendingTransactions &&
                // the open ticket signs from its own numbers; only a new one needs the form's request
                (submit.canSignOpened || (!submit.lockedAfterInit && !!request))
            }
            // an opened ticket keeps its amount: back leaves instead of editing it
            onBack={() => (submit.lockedAfterInit ? leaveFlow() : void stepper.goTo('amount'))}
            onCancel={leaveFlow}
            onConfirm={async () => {
                if (submit.canSignOpened) return submit.confirmOpened()
                if (!request || !preview.data) return
                posthog.capture(ANALYTICS_EVENTS.WITHDRAW_CONFIRMED, {
                    amount_usd: preview.data.withdrawUsd,
                    method_type: 'avenia',
                    country: 'brazil',
                })
                await submit.submit(request, preview.data)
            }}
        />
    )
}

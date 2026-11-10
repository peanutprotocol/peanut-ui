'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { PIX_WITHDRAW_STEPS, pixWithdrawAmount, completePixKey } from '@/features/pix/pixFlow.utils'
import { PixKeyStep } from '@/features/pix/components/PixKeyStep'
import { PixSetup } from '@/features/pix/components/PixSetup'
import { PixWithdrawOutcome } from '@/features/pix/components/PixWithdrawOutcome'
import { PixWithdrawReview } from '@/features/pix/components/PixWithdrawReview'
import { usePixRefusalMessage } from '@/features/pix/usePixRefusalMessage'
import { usePixWithdrawSubmit } from '@/features/pix/usePixWithdrawSubmit'
import { WITHDRAW_BACK_FALLBACK_URL } from '@/features/withdraw/routes'
import { useWithdrawAmount, useWithdrawDestinationAmount } from '@/features/withdraw/useWithdrawAmount'
import { usePixQuoteCurrency } from '@/features/pix/usePixQuoteCurrency'
import { usePixPendingTransfer } from '@/features/pix/usePixPendingTransfer'
import { isUnderPixMinimum } from '@/features/pix/pixQuote.utils'
import { pixMinimumBrl } from '@/features/pix/pixRoute.utils'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useAuth } from '@/context/authContext'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { useWallet } from '@/hooks/wallet/useWallet'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { pixApi } from '@/services/pix'
import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import type { CapabilityRoute } from '@/types/capabilities'
import { isAmountWithinBalance } from '@/utils/balance.utils'
import { formatBankAmount } from '@/utils/currency'
import { pixProviderId } from '@/utils/provider.utils'

/**
 * Withdraw by Pix, for whichever provider the withdraw route names: the own
 * Pix key, the amount, the review, then the signature. The key and the
 * amount live in the URL (`?destination=`, `?amount=` in USD,
 * `?destinationAmount=` in reais or `?spend=` for the whole balance), so a
 * refresh keeps the step; nothing is opened at the provider before Confirm.
 */
export function PixWithdrawFlow({ route }: { route: CapabilityRoute }) {
    const t = useTranslations('pix.withdraw')
    const tShared = useTranslations('pix')
    const tWithdraw = useTranslations('withdraw')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const tErrors = useTranslations('errors')
    const router = useRouter()
    const { isFromSendFlow } = useSendFlowOrigin()
    const title = tNav(isFromSendFlow ? 'send' : 'withdraw')
    const backToWithdraw = useSafeBack(WITHDRAW_BACK_FALLBACK_URL)
    const { fetchUser } = useAuth()
    // the provider the route names, for the provider row and its sheet
    const providerId = pixProviderId(route.provider)
    const leaveFlow = () => (isFromSendFlow ? router.replace('/send') : backToWithdraw())

    const [destination, setDestination] = useQueryState('destination', parseAsString.withDefault(''))
    // set once Confirm opened the withdrawal: from then on the URL shows its outcome, never the form again
    const [intentId, setIntentId] = useQueryState('intentId', parseAsString.withDefault(''))
    const [amountUsd, setAmountUsd] = useWithdrawAmount()
    const [amountBrl, setAmountBrl] = useWithdrawDestinationAmount()
    // "Use balance": the USDC that leaves the wallet, every fee included, so the whole balance can go
    const [spendUsd, setSpendUsd] = useQueryState('spend', parseAsString.withDefault(''))
    const pixKey = completePixKey(destination)
    const amount = pixWithdrawAmount({ amountUsd, amountBrl, spendUsd })
    const submit = usePixWithdrawSubmit({
        provider: route.provider,
        // From the open withdrawal on, the URL names it, not the form: step and intentId only. The
        // key and the amount live with the provider, and a reload reads its outcome. A submit that
        // could not name its withdrawal still drops the form, so a reload cannot send it twice.
        onOpened: (id) => {
            void setIntentId(id)
            void setDestination(null)
            void setAmountUsd(null)
            void setAmountBrl(null)
            void setSpendUsd(null)
        },
    })
    const { hasPendingTransactions } = usePendingTransactions()

    const isSent = submit.phase === 'funded' || submit.phase === 'unconfirmed'
    // A withdrawal submitted with no answer naming it, from this visit or an earlier one: until its
    // history row shows or its lock's window has passed, the page shows it, never a new Confirm.
    // While this visit signs one, the reducer holds it instead.
    const pending = usePixPendingTransfer({
        enabled: !intentId && (!submit.opened || isSent),
        onFound: useCallback(
            (id: string) => {
                void setIntentId(id)
                void setDestination(null)
                void setAmountUsd(null)
                void setAmountBrl(null)
                void setSpendUsd(null)
            },
            [setIntentId, setDestination, setAmountUsd, setAmountBrl, setSpendUsd]
        ),
    })
    const stepper = useFlowStepper({
        steps: PIX_WITHDRAW_STEPS,
        guards: {
            amount: { ok: !!pixKey, fallback: 'pix-key' },
            // an opened withdrawal stays on its review: the URL then holds only its id
            review: { ok: (!!pixKey && !!amount) || !!intentId, fallback: pixKey ? 'amount' : 'pix-key' },
            success: { ok: !!intentId || isSent || !!pending },
        },
    })
    const step = stepper.step
    const { goTo } = stepper
    // The funding was sent, the page reloaded after Confirm opened the withdrawal (the signature
    // is gone with the memory), or a submit may have gone out: the last step is the only way on.
    const showOutcome = isSent || (!!intentId && !submit.opened) || !!pending
    useEffect(() => {
        if (showOutcome && step !== 'success') void goTo('success')
    }, [showOutcome, step, goTo])

    const request = pixKey && amount ? { pixKey, ...amount } : null
    const preview = useQuery({
        queryKey: ['pix-withdraw-preview', request],
        queryFn: () => pixApi.previewWithdrawal(request!),
        // the review shows it; once Confirm opened the ticket (`?intentId=`), the confirmed numbers stand
        enabled: step === 'review' && !!request && !intentId && !submit.lockedAfterInit && !pending,
        retry: false,
        staleTime: 30_000,
    })

    // a refused route or a paused provider since the screen loaded: the capabilities say where the user stands now
    const previewCode = wireErrorCode(preview.error)
    useEffect(() => {
        if (previewCode === API_ERROR_CODES.ROUTE_NOT_AVAILABLE || previewCode === API_ERROR_CODES.PROVIDER_UNAVAILABLE)
            void fetchUser().catch(() => undefined)
    }, [previewCode, fetchUser])

    const { spendableBalance, formattedSpendableBalance, spendableBalanceDecimal } = useWallet()
    const [typedBrl, setTypedBrl] = useState<string | undefined>(undefined)
    // The route states the provider's minimum: an amount under it is refused here, before any quote.
    // The amount step's estimate is the provider's quote for the reais on screen, not the /fx rate.
    // Only the amount step quotes: the setup, key, review and last steps do not.
    const minimumBrl = pixMinimumBrl(route)
    const brl = usePixQuoteCurrency(
        'withdraw',
        typedBrl,
        minimumBrl,
        route.state === 'ready' && step === 'amount' && !showOutcome
    )
    // the review's refusal lines name the same minimum
    const refusalMessage = usePixRefusalMessage(minimumBrl)
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
            <PixWithdrawOutcome
                title={title}
                intentId={submit.opened?.intentId ?? (intentId || null)}
                providerId={providerId}
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
                        : pending
                          ? { phase: 'unconfirmed', display: pending.display }
                          : null
                }
            />
        )
    }

    if (route.state !== 'ready') return <PixSetup title={title} onBack={leaveFlow} route={route} />

    if (step === 'pix-key') {
        return (
            <PixKeyStep
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
        // "Use balance" sends the balance itself (spendUsd), which fits by construction; the
        // estimate beside it is the quote's price for the reais, which can read a cent over
        const balanceError =
            enteredIn !== 'balance' &&
            usdForBalance &&
            Number(usdForBalance) > 0 &&
            !isAmountWithinBalance(usdForBalance, spendableBalance)
                ? tErrors('insufficientBalance')
                : undefined
        // the reais the field shows, typed or converted; the API checks the credited amount again
        const amountError =
            balanceError ??
            (minimumBrl && isUnderPixMinimum(typedBrl, minimumBrl)
                ? tShared('deposit.minimum', { amount: formatBankAmount(minimumBrl, 'BRL') })
                : undefined)
        return (
            <PageStack>
                <NavHeader title={title} onPrev={() => void stepper.goTo('pix-key')} />
                <PageStack.Center>
                    <div className="text-heading-xs text-foreground-primary">{tWithdraw('amountToWithdraw')}</div>
                    {/* the quote failed (the route changed, the provider is down): retry here, not a spinner */}
                    {spendableBalance === 0n ? (
                        // nothing to withdraw: the field's own error line, no amount to type
                        <Field error={tErrors('insufficientBalance')}>{null}</Field>
                    ) : brl.isError ? (
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
                                method_type: route.provider,
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
    // Each refusal offers the one step that can change it: never a Retry that repeats the refused key or amount.
    const previewAction = (code: string | undefined) => {
        switch (code) {
            // another amount can pass: back to the amount step, the key stays
            case API_ERROR_CODES.PIX_LIMIT_EXCEEDED:
            case API_ERROR_CODES.PIX_MIN_AMOUNT:
                return { label: t('changeAmount'), onClick: () => void stepper.goTo('amount') }
            // the key itself was refused: back to the key step, the key kept in the field to edit
            case API_ERROR_CODES.PIX_KEY_NOT_OWN:
            case API_ERROR_CODES.PIX_KEY_BLOCKED:
            case API_ERROR_CODES.PIX_KEY_NOT_FOUND:
                return { label: t('changeKey'), onClick: () => void stepper.goTo('pix-key') }
            // only time helps (the message says so), or only support can (the callout offers it)
            case API_ERROR_CODES.WITHDRAWAL_IN_PROGRESS:
            case API_ERROR_CODES.PROVIDER_REJECTED:
                return undefined
            // a moved quote, a throttled lookup, an outage or a network failure can pass on a retry
            default:
                return { label: tCommon('retry'), onClick: () => void preview.refetch() }
        }
    }
    const reviewError = submit.error
        ? // once the withdrawal is open, only a signature that surely sent nothing may be tried again
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
        <PixWithdrawReview
            title={title}
            display={display}
            providerId={providerId}
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
                    method_type: route.provider,
                    country: 'brazil',
                })
                await submit.submit(request, preview.data)
            }}
        />
    )
}

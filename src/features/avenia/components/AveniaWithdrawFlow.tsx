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
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import {
    AVENIA_MIN_WITHDRAWAL_BRL,
    AVENIA_WITHDRAW_STEPS,
    aveniaSetupState,
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
import { useCurrency } from '@/hooks/useCurrency'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { useWallet } from '@/hooks/wallet/useWallet'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { aveniaApi } from '@/services/avenia'
import type { RailCapability } from '@/types/capabilities'
import { isAmountWithinBalance } from '@/utils/balance.utils'
import { formatBankAmount } from '@/utils/currency'

/**
 * Withdraw by Pix for a Brazilian resident on Avenia: the own Pix key, the
 * amount, the review, then the signature. The key and the amount live in the
 * URL (`?destination=`, `?amount=` in USD, `?destinationAmount=` in reais or
 * `?spend=` for the whole balance), so a refresh keeps the step; nothing is
 * opened at Avenia before Confirm.
 */
export function AveniaWithdrawFlow({ rail }: { rail: RailCapability | undefined }) {
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
    const submit = useAveniaWithdrawSubmit({ onOpened: (id) => void setIntentId(id) })
    const { hasPendingTransactions } = usePendingTransactions()

    const stepper = useFlowStepper({
        steps: AVENIA_WITHDRAW_STEPS,
        guards: {
            amount: { ok: !!pixKey, fallback: 'pix-key' },
            review: { ok: !!pixKey && !!amount, fallback: pixKey ? 'amount' : 'pix-key' },
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
    const brl = useCurrency('BRL')
    const [typedBrl, setTypedBrl] = useState<string | undefined>(undefined)
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

    if (aveniaSetupState(rail) !== 'ready') return <AveniaPixSetup title={title} onBack={leaveFlow} rail={rail} />

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
                    {brl.isLoading || !brl.price ? (
                        <Loading />
                    ) : (
                        <Field error={amountError}>
                            <AmountInput
                                initialAmount={seedBrl}
                                setPrimaryAmount={setTypedBrl}
                                setSecondaryAmount={setTypedUsd}
                                primaryDenomination={{ symbol: 'BRL', price: brl.price.sell, decimals: 2 }}
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
                        disabled={!Number(typedUsd) || !!amountError}
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
    const reviewError = submit.error
        ? // once Avenia's ticket is open, a second Confirm could pay twice: no retry here
          { message: submit.lockedAfterInit ? `${submit.error} ${t('errors.afterInit')}` : submit.error }
        : preview.error
          ? { message: refusalMessage(preview.error), onRetry: () => void preview.refetch() }
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
                !!request &&
                !fundsShort &&
                // another balance-decreasing send is still in flight
                !hasPendingTransactions &&
                (reconfirm || !submit.lockedAfterInit)
            }
            // an opened ticket keeps its amount: back leaves instead of editing it
            onBack={() => (submit.lockedAfterInit ? leaveFlow() : void stepper.goTo('amount'))}
            onCancel={leaveFlow}
            onConfirm={async () => {
                if (reconfirm) return submit.confirmOpened()
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

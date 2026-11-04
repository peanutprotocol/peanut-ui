'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { Button } from '@/components/0_Bruddle/Button'
import { Field } from '@/components/0_Bruddle/Field'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import AmountInput from '@/components/Global/AmountInput'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { ProviderFinePrint } from '@/components/Provider/ProviderFinePrint'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import {
    AVENIA_WITHDRAW_STEPS,
    aveniaSetupState,
    aveniaWithdrawAmount,
    aveniaWithdrawRefusalKey,
    completePixKey,
} from '@/features/avenia/avenia.utils'
import { AveniaPixKeyStep } from '@/features/avenia/components/AveniaPixKeyStep'
import { AveniaPixSetup } from '@/features/avenia/components/AveniaPixSetup'
import { AveniaWithdrawReview } from '@/features/avenia/components/AveniaWithdrawReview'
import { useAveniaWithdrawSubmit } from '@/features/avenia/hooks/useAveniaWithdrawSubmit'
import { WITHDRAW_BACK_FALLBACK_URL } from '@/features/withdraw/routes'
import { useWithdrawAmount, useWithdrawDestinationAmount } from '@/features/withdraw/useWithdrawAmount'
import { useCurrency } from '@/hooks/useCurrency'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import { useReturnTo, useSafeBack } from '@/hooks/useSafeBack'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import { useWallet } from '@/hooks/wallet/useWallet'
import { aveniaApi } from '@/services/avenia'
import { wireErrorCode } from '@/services/api-error'
import type { RailCapability } from '@/types/capabilities'
import { isAmountWithinBalance } from '@/utils/balance.utils'
import { formatBankAmount } from '@/utils/currency'

/**
 * Withdraw by Pix for a Brazilian resident on Avenia: the own Pix key, the
 * amount, the review, then the signature. The key and the amount live in the
 * URL (`?destination=`, `?amount=` in USD or `?destinationAmount=` in reais),
 * so a refresh keeps the step; nothing is opened at Avenia before Confirm.
 */
export function AveniaWithdrawFlow({ rail }: { rail: RailCapability | undefined }) {
    const t = useTranslations('avenia.withdraw')
    const tShared = useTranslations('avenia')
    const tWithdraw = useTranslations('withdraw')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const tErrors = useTranslations('errors')
    const router = useRouter()
    const { isFromSendFlow } = useSendFlowOrigin()
    const title = tNav(isFromSendFlow ? 'send' : 'withdraw')
    const backToWithdraw = useSafeBack(WITHDRAW_BACK_FALLBACK_URL)
    const leaveFlow = () => (isFromSendFlow ? router.replace('/send') : backToWithdraw())
    const leaveToHome = useReturnTo('/home')

    const [destination, setDestination] = useQueryState('destination', parseAsString.withDefault(''))
    const [amountUsd, setAmountUsd] = useWithdrawAmount()
    const [amountBrl, setAmountBrl] = useWithdrawDestinationAmount()
    const pixKey = completePixKey(destination)
    const amount = aveniaWithdrawAmount({ amountUsd, amountBrl })
    const submit = useAveniaWithdrawSubmit()

    const stepper = useFlowStepper({
        steps: AVENIA_WITHDRAW_STEPS,
        guards: {
            amount: { ok: !!pixKey, fallback: 'pix-key' },
            review: { ok: !!pixKey && !!amount, fallback: pixKey ? 'amount' : 'pix-key' },
            success: { ok: submit.phase === 'sent' || submit.phase === 'unconfirmed' },
        },
    })
    const step = stepper.step
    const { goTo } = stepper
    // the deposit was sent: the success step is the only way on
    const isSent = submit.phase === 'sent' || submit.phase === 'unconfirmed'
    useEffect(() => {
        if (isSent && step !== 'success') void goTo('success')
    }, [isSent, step, goTo])

    const request = pixKey && amount ? { pixKey, ...amount } : null
    const preview = useQuery({
        queryKey: ['avenia-withdraw-preview', request],
        queryFn: () => aveniaApi.previewWithdrawal(request!),
        // the review shows it; once Confirm opened the ticket, the confirmed numbers stand
        enabled: step === 'review' && !!request && !submit.lockedAfterInit,
        retry: false,
        staleTime: 30_000,
    })

    const { spendableBalance, formattedSpendableBalance, spendableBalanceDecimal } = useWallet()
    const brl = useCurrency('BRL')
    const [typedBrl, setTypedBrl] = useState<string | undefined>(undefined)
    const [typedUsd, setTypedUsd] = useState<string | undefined>(undefined)
    const [enteredIn, setEnteredIn] = useState<'local' | 'usd'>(amountBrl ? 'local' : 'usd')
    const seedBrl = useMemo(() => {
        if (amountBrl) return amountBrl
        const usd = Number(amountUsd)
        return usd > 0 && brl.price ? (usd * brl.price.sell).toFixed(2) : undefined
    }, [amountBrl, amountUsd, brl.price])

    if (aveniaSetupState(rail) !== 'ready') return <AveniaPixSetup title={title} onBack={leaveFlow} rail={rail} />

    if (step === 'success' && submit.opened && isSent) {
        const { display } = submit.opened
        const to = [display.bankName, display.holderName].filter(Boolean).join(' · ')
        const confirmed = submit.phase === 'sent'
        return (
            <PageStack>
                {confirmed && <SoundPlayer sound="success" />}
                <NavHeader title={title} hideBackBtn />
                <PageStack.Center className="items-center text-center">
                    {/* a receipt that never came is a wait, not a success */}
                    <IconBubble icon={confirmed ? 'check' : 'clock'} size="l" color={confirmed ? 'green' : 'yellow'} />
                    <TitleBlock
                        align="center"
                        title={formatBankAmount(display.amountBrl, 'BRL')}
                        description={!confirmed ? t('unconfirmed') : to ? t('sentTo', { destination: to }) : t('sent')}
                    />
                    <Button variant="primary" className="w-full" onClick={leaveToHome}>
                        {tCommon('done')}
                    </Button>
                    <ProviderFinePrint providerId="avenia-br" />
                </PageStack.Center>
            </PageStack>
        )
    }

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
        return (
            <PageStack>
                <NavHeader title={title} onPrev={() => void stepper.goTo('pix-key')} />
                <PageStack.Center>
                    <div className="text-heading-xs text-foreground-primary">{tWithdraw('amountToWithdraw')}</div>
                    {brl.isLoading || !brl.price ? (
                        <Loading />
                    ) : (
                        <Field error={balanceError}>
                            <AmountInput
                                initialAmount={seedBrl}
                                setPrimaryAmount={setTypedBrl}
                                setSecondaryAmount={setTypedUsd}
                                primaryDenomination={{ symbol: 'BRL', price: brl.price.sell, decimals: 2 }}
                                secondaryDenomination={{ symbol: 'USD', price: 1, decimals: 2 }}
                                onBalanceFilled={() => setEnteredIn('usd')}
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
                        disabled={!Number(typedUsd) || !!balanceError}
                        onClick={() => {
                            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_AMOUNT_ENTERED, {
                                amount_usd: typedUsd,
                                method_type: 'avenia',
                                country: 'brazil',
                            })
                            // the API takes one amount: the one the user typed
                            if (enteredIn === 'local' && typedBrl) {
                                void setAmountBrl(typedBrl)
                                void setAmountUsd(null)
                            } else {
                                void setAmountUsd(typedUsd ?? null)
                                void setAmountBrl(null)
                            }
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
          ? { message: previewErrorMessage(preview.error), onRetry: () => void preview.refetch() }
          : fundsShort
            ? { message: tErrors('insufficientBalance') }
            : reconfirm
              ? { message: t('quoteMoved'), priority: 'attention' as const }
              : null

    function previewErrorMessage(error: unknown): string {
        const key = aveniaWithdrawRefusalKey(wireErrorCode(error))
        return key === 'providerRejected' ? tErrors(key) : tShared(key)
    }

    return (
        <AveniaWithdrawReview
            title={title}
            display={display}
            isLoading={preview.isLoading}
            isSubmitting={submit.phase === 'starting' || submit.phase === 'signing'}
            error={reviewError}
            canConfirm={!!display && !!request && !fundsShort && (reconfirm || !submit.lockedAfterInit)}
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

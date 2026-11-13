'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { formatUnits } from 'viem'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { PIX_WITHDRAW_STEPS, pixWithdrawAmount, completePixKey } from '@/features/pix/pixFlow.utils'
import { PixKeyStep } from '@/features/pix/components/PixKeyStep'
import { PixSetup } from '@/features/pix/components/PixSetup'
import { PixWithdrawForm, type PixWithdrawAmountSeed } from '@/features/pix/components/PixWithdrawForm'
import { PixWithdrawOutcome } from '@/features/pix/components/PixWithdrawOutcome'
import { usePixRefusalMessage } from '@/features/pix/usePixRefusalMessage'
import { usePixWithdrawSubmit } from '@/features/pix/usePixWithdrawSubmit'
import { WITHDRAW_BACK_FALLBACK_URL } from '@/features/withdraw/routes'
import { TYPING_SETTLE_MS, usePixQuoteCurrency } from '@/features/pix/usePixQuoteCurrency'
import { usePixPendingTransfer } from '@/features/pix/usePixPendingTransfer'
import { usePixWithdrawDraft } from '@/features/pix/usePixWithdrawDraft'
import { usePixKeySavePrompt } from '@/features/payments/flows/qr-pay/usePixKeySavePrompt'
import { isUnderPixMinimum, pixQuotePrice } from '@/features/pix/pixQuote.utils'
import { pixMinimumBrl } from '@/features/pix/pixRoute.utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useAuth } from '@/context/authContext'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { useWallet } from '@/hooks/wallet/useWallet'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { pixApi, type PixKeyInfo } from '@/services/pix'
import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import type { CapabilityRoute } from '@/types/capabilities'
import { isAmountWithinBalance } from '@/utils/balance.utils'
import { formatBankAmount } from '@/utils/currency'
import { usePixProviderId } from '@/features/pix/usePixProviderId'

/**
 * Withdraw by Pix, for whichever provider the withdraw route names: the own
 * Pix key, then one form (the Pix-key payment form: the amount, its quote and
 * Confirm on one screen; ruling 2026-11-12), then the signature. The URL
 * holds the step and, once Confirm opened the withdrawal, its `?intentId=`;
 * nothing else. The key and the amount (in USD, in reais, or the whole
 * balance) live in the account's draft in this tab's session
 * (`pixWithdrawDraft`), never in the URL, so a refresh keeps the step and the
 * form without the Pix key reaching analytics, history or request logs.
 * Nothing is opened at the provider before Confirm.
 */
export function PixWithdrawFlow({ route }: { route: CapabilityRoute }) {
    const t = useTranslations('pix.withdraw')
    const tShared = useTranslations('pix')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const tErrors = useTranslations('errors')
    const router = useRouter()
    const { isFromSendFlow } = useSendFlowOrigin()
    const title = tNav(isFromSendFlow ? 'send' : 'withdraw')
    const backToWithdraw = useSafeBack(WITHDRAW_BACK_FALLBACK_URL)
    const { fetchUser } = useAuth()
    // the provider the route names, for the provider row and its sheet
    const providerId = usePixProviderId(route.provider)
    const leaveFlow = () => (isFromSendFlow ? router.replace('/send') : backToWithdraw())

    // set once Confirm opened the withdrawal: from then on the URL shows its outcome, never the form again
    const [intentId, setIntentId] = useQueryState('intentId', parseAsString.withDefault(''))
    // the key and the one amount ("Use balance" is spendUsd: the USDC that leaves the wallet, every fee included)
    const { draft, update: updateDraft, clear: clearDraft } = usePixWithdrawDraft()
    const { destination, amountUsd, amountBrl, spendUsd } = draft
    const pixKey = completePixKey(destination)
    // what the key step learned of the key's holder; after a reload the quote names them instead
    const [keyInfo, setKeyInfo] = useState<PixKeyInfo | null>(null)
    const submit = usePixWithdrawSubmit({
        provider: route.provider,
        // From the open withdrawal on, the URL names it and the draft goes: the key and the amount
        // live with the provider, and a reload reads its outcome. A submit that could not name its
        // withdrawal still drops the draft, so a reload cannot send it twice.
        onOpened: (id) => {
            void setIntentId(id)
            clearDraft()
        },
    })
    const { hasPendingTransactions } = usePendingTransactions()

    const isSent = submit.phase === 'funded' || submit.phase === 'unconfirmed'
    // A withdrawal this account submitted with no answer naming it, from this visit or an earlier
    // one: until its lock's window has passed, the page shows it, never a new Confirm. While this
    // visit signs one, the reducer holds it instead.
    const pending = usePixPendingTransfer({ enabled: !intentId && (!submit.opened || isSent) })
    const stepper = useFlowStepper({
        steps: PIX_WITHDRAW_STEPS,
        guards: {
            // an opened withdrawal stays on its form: the URL then holds only its id
            review: { ok: !!pixKey || !!intentId, fallback: 'pix-key' },
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

    const { spendableBalance, formattedSpendableBalance, spendableBalanceDecimal } = useWallet()
    // The amount as typed, in the denomination it was typed in, or the balance when it was tapped.
    // Seeded from the draft, so a reload restores the form.
    const [typedBrl, setTypedBrl] = useState<string | undefined>(amountBrl || undefined)
    const [typedUsd, setTypedUsd] = useState<string | undefined>(amountUsd || spendUsd || undefined)
    const [enteredIn, setEnteredIn] = useState<'local' | 'usd' | 'balance'>(
        amountBrl ? 'local' : spendUsd ? 'balance' : 'usd'
    )
    // What the user entered, in the denomination they entered it. The field's other line is a
    // conversion that moves with the price, not a change of mind, so it never counts as typing.
    const entered = enteredIn === 'local' ? typedBrl : enteredIn === 'usd' ? typedUsd : 'balance'
    const typed = useMemo(() => ({ enteredIn, entered }), [enteredIn, entered])
    // The amount counts once typing stops: the draft keeps it and the provider quotes it, never
    // each keystroke. Until then Confirm waits, so the wallet never signs an amount still changing.
    const settledTyped = useDebounce(typed, TYPING_SETTLE_MS)
    const settled = settledTyped === typed

    // the form is on screen and its amount can still change: once Confirm opened a withdrawal, its numbers stand
    const formOpen = route.state === 'ready' && step === 'review' && !showOutcome && !submit.lockedAfterInit
    // The route states the provider's minimum: an amount under it is refused here, before any quote.
    // The field's estimate is the provider's quote for the reais on screen, not the /fx rate.
    const minimumBrl = pixMinimumBrl(route)
    const brl = usePixQuoteCurrency('withdraw', typedBrl, minimumBrl, formOpen)
    // the form's refusal lines name the same minimum
    const refusalMessage = usePixRefusalMessage(minimumBrl)

    // the API takes one amount: the one the user typed, or the balance they tapped
    const balanceUsd =
        settledTyped.enteredIn === 'balance' && spendableBalance !== undefined
            ? formatUnits(spendableBalance, PEANUT_WALLET_TOKEN_DECIMALS)
            : null
    const typedLocal = settledTyped.enteredIn === 'local' ? (settledTyped.entered ?? '') : ''
    const typedUsdOnly = settledTyped.enteredIn === 'usd' ? (settledTyped.entered ?? '') : ''
    const form = {
        spendUsd: balanceUsd ?? '',
        amountBrl: balanceUsd ? '' : typedLocal,
        amountUsd: balanceUsd || typedLocal ? '' : typedUsdOnly,
    }
    // the draft keeps the settled amount, so a reload restores the form; an opened withdrawal holds its own
    useEffect(() => {
        if (!formOpen) return
        if (
            draft.spendUsd === form.spendUsd &&
            draft.amountBrl === form.amountBrl &&
            draft.amountUsd === form.amountUsd
        )
            return
        updateDraft(form)
    }, [
        formOpen,
        form.spendUsd,
        form.amountBrl,
        form.amountUsd,
        draft.spendUsd,
        draft.amountBrl,
        draft.amountUsd,
        updateDraft,
    ])

    const insufficient = tErrors('insufficientBalance')
    // "Use balance" sends the balance itself (spendUsd), which fits by construction; the estimate
    // beside it is the quote's price for the reais, which can read a cent over
    const balanceError =
        spendableBalance === 0n
            ? insufficient
            : enteredIn !== 'balance' &&
                typedUsd &&
                Number(typedUsd) > 0 &&
                !isAmountWithinBalance(typedUsd, spendableBalance)
              ? insufficient
              : undefined
    // Typed reais are checked against the provider's minimum here; the API checks the credited amount
    // again. Reais converted from USD or the balance are an estimate that a bridge fee can put under
    // the minimum while the payout is not (USD 4 can debit 4.10 USDC and still pay R$20), so there
    // the quote's own payout decides: a short one comes back as the API's minimum refusal.
    const amountError =
        balanceError ??
        (enteredIn === 'local' && minimumBrl && isUnderPixMinimum(typedBrl, minimumBrl)
            ? tShared('deposit.minimum', { amount: formatBankAmount(minimumBrl, 'BRL') })
            : undefined)

    const amount = pixWithdrawAmount(form)
    const request = pixKey && amount ? { pixKey, ...amount } : null
    const preview = useQuery({
        queryKey: ['pix-withdraw-preview', request],
        queryFn: () => pixApi.previewWithdrawal(request!),
        // the form shows it; once Confirm opened the ticket (`?intentId=`), the confirmed numbers stand
        enabled: formOpen && !!request && !amountError && !intentId && !pending,
        retry: false,
        staleTime: 30_000,
    })

    // a refused route or a paused provider since the screen loaded: the capabilities say where the user stands now
    const previewCode = wireErrorCode(preview.error)
    useEffect(() => {
        if (previewCode === API_ERROR_CODES.ROUTE_NOT_AVAILABLE || previewCode === API_ERROR_CODES.PROVIDER_UNAVAILABLE)
            void fetchUser().catch(() => undefined)
    }, [previewCode, fetchUser])

    // the withdraw funnel's amount step: once per visit, when the amount first settles into a quote request
    const amountEntered = useRef(false)
    useEffect(() => {
        if (!formOpen || !request || amountEntered.current) return
        amountEntered.current = true
        posthog.capture(ANALYTICS_EVENTS.WITHDRAW_AMOUNT_ENTERED, {
            amount_usd: typedUsd,
            method_type: route.provider,
            country: 'brazil',
        })
    }, [formOpen, request, typedUsd, route.provider])

    // The quote for the amount on screen: once Confirm opened the ticket, its own numbers are the
    // ones the wallet signs; else the preview of the settled amount. Null while the amount still
    // changes or its quote is in flight, so Confirm and the exact rows wait for it.
    const display = submit.opened?.display ?? (settled ? (preview.data ?? null) : null)
    // the holder and bank, from any quote of this key or from the key step
    const named = submit.opened?.display ?? preview.data ?? null
    const holderName = named?.holderName ?? keyInfo?.holderName ?? null
    // "Save to favorites", as the Pix-key payment offers it: the key the withdrawal pays (the draft
    // goes when the withdrawal opens), named after its holder, saved once the funding is sent
    const pixKeySave = usePixKeySavePrompt(submit.opened?.display.pixKey ?? pixKey, holderName ?? undefined)
    const { saveAfterPayment: saveKey } = pixKeySave
    useEffect(() => {
        if (isSent) saveKey()
    }, [isSent, saveKey])
    // Once the quote is in hand the field converts with its exact ratio; until then the indicative
    // price. Typed reais, or the balance: reais per USD that leaves the wallet, so the USD under the
    // amount is the debit itself and agrees with the Total row. Typed USD: reais per USD entered,
    // the provider input the quote converts, so the reais under the amount are the payout itself
    // and the debit, a bridge fee larger, stands in the Total row alone. The payout over the debit
    // would read R$19.51 for a USD 4 that pays R$20, and hold the form under the minimum (Chip, ui#4082).
    const exactPrice = display
        ? pixQuotePrice({
              amountBrl: display.amountBrl,
              usdcAmount: settledTyped.enteredIn === 'usd' ? (settledTyped.entered ?? '') : display.withdrawUsd,
          })
        : null
    const price = exactPrice ?? brl.price?.sell ?? null

    if (showOutcome) {
        return (
            <PixWithdrawOutcome
                title={title}
                intentId={submit.opened?.intentId ?? (intentId || null)}
                providerId={providerId}
                // nothing left the wallet: a new withdrawal, from its key (the draft went when it opened)
                onStartAgain={() => {
                    void setIntentId(null)
                    void stepper.goTo('pix-key')
                }}
                onDone={clearDraft}
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
                onContinue={(key, info) => {
                    setKeyInfo(info)
                    updateDraft({ destination: key })
                    void stepper.goTo('review')
                }}
            />
        )
    }

    const reconfirm = submit.phase === 'reconfirm'
    const fundsShort = !!display && !isAmountWithinBalance(display.withdrawUsd, spendableBalance)
    // an amount the provider quotes, or has quoted: the opened ticket's, or one the form does not refuse itself
    const quoting = !!submit.opened || (!!request && !amountError && !preview.error)
    // Each refusal offers the one step that can change it: the key step for a refused key, a Retry
    // for a moved quote, a throttled lookup, an outage or a network failure. An amount refusal
    // offers no step: the field is on this screen. Only time helps a withdrawal still on its way,
    // and only support a rejected account (the callout offers it).
    const previewAction = (code: string | undefined) => {
        switch (code) {
            case API_ERROR_CODES.PIX_LIMIT_EXCEEDED:
            case API_ERROR_CODES.PIX_MIN_AMOUNT:
            case API_ERROR_CODES.WITHDRAWAL_IN_PROGRESS:
            case API_ERROR_CODES.PROVIDER_REJECTED:
                return undefined
            // the key itself was refused: back to the key step, the key kept in the field to edit
            case API_ERROR_CODES.PIX_KEY_NOT_OWN:
            case API_ERROR_CODES.PIX_KEY_BLOCKED:
            case API_ERROR_CODES.PIX_KEY_NOT_FOUND:
                return { label: t('changeKey'), onClick: () => void stepper.goTo('pix-key') }
            default:
                return { label: tCommon('retry'), onClick: () => void preview.refetch() }
        }
    }
    const formError = submit.error
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
            ? { message: insufficient }
            : reconfirm
              ? { message: t('quoteMoved'), priority: 'attention' as const }
              : null

    // the field starts from the amount already typed (a reload, or back from the key step), in its own denomination
    const seed: PixWithdrawAmountSeed | null =
        enteredIn === 'local' && typedBrl
            ? { amount: typedBrl, denomination: 'BRL' }
            : typedUsd
              ? { amount: typedUsd, denomination: 'USD' }
              : null

    return (
        <PixWithdrawForm
            title={title}
            // an opened ticket keeps its key and amount: back leaves instead of editing them
            onBack={() => (submit.lockedAfterInit ? leaveFlow() : void stepper.goTo('pix-key'))}
            recipient={{
                pixKey: named?.pixKey ?? pixKey ?? '',
                holderName,
                bankName: named?.bankName ?? keyInfo?.bankName ?? null,
                taxIdMasked: keyInfo?.holderTaxIdMasked ?? null,
            }}
            save={pixKeySave}
            amount={{
                seed,
                price,
                isLoading: brl.isLoading,
                isError: brl.isError,
                onRetry: brl.refetch,
                disabled: submit.phase !== 'idle',
                error: amountError,
                walletBalance: spendableBalance !== undefined ? formattedSpendableBalance : undefined,
                balanceFillAmount:
                    spendableBalanceDecimal !== undefined && price !== null
                        ? spendableBalanceDecimal * price
                        : undefined,
                onBrlChange: setTypedBrl,
                onUsdChange: setTypedUsd,
                onBalanceFilled: () => setEnteredIn('balance'),
                onAmountTyped: (symbol) => setEnteredIn(symbol.toUpperCase() === 'USD' ? 'usd' : 'local'),
            }}
            display={display}
            // the exact reais where the user typed USD or tapped the balance (typed reais are credited as typed), and the exact
            // wallet debit; each waits for the quote of the amount on screen, and neither shows for an amount the form refuses
            payout={
                quoting && enteredIn !== 'local'
                    ? display
                        ? formatBankAmount(display.amountBrl, 'BRL')
                        : null
                    : undefined
            }
            total={quoting ? (display ? formatBankAmount(display.withdrawUsd, 'USD') : null) : undefined}
            providerId={providerId}
            error={formError}
            isSubmitting={submit.phase === 'starting' || submit.phase === 'signing'}
            canConfirm={
                // the quote of the settled amount is in hand (or the opened ticket's), never an estimate
                !!display &&
                !fundsShort &&
                // another balance-decreasing send is still in flight
                !hasPendingTransactions &&
                // a ticked "Save to favorites" needs its name, as on the payment form
                !pixKeySave.blocksPay &&
                // the open ticket signs from its own numbers; only a new one needs the form's request
                (submit.canSignOpened || (!submit.lockedAfterInit && !!request && !amountError))
            }
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

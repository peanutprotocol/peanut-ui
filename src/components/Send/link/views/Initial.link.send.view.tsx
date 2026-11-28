'use client'

import { sendLinkFromFoundDeposit, useCreateLink, type CreatedSendLink } from '@/components/Create/useCreateLink'
import { usePendingChargeSend } from '@/features/payments/shared/hooks/usePendingChargeSend'
import type { PendingChargeSend } from '@/features/payments/shared/utils/pending-charge-send'
import { Field } from '@/components/0_Bruddle/Field'
import { Callout } from '@/components/0_Bruddle/Callout'
import CooldownErrorText from '@/components/Global/RainCooldown/CooldownErrorText'
import PeanutActionCard from '@/components/Global/PeanutActionCard'
import { CLAIM_RAIL_MINIMUMS } from '@/constants/payment.consts'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { TRANSACTIONS } from '@/constants/query.consts'
import { loadingStateContext } from '@/context/loadingStates.context'
import { useLinkSendFlow } from '@/context/LinkSendFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { SpendRecoveryAbortedError } from '@/hooks/wallet/signSpendRetry'
import { sendLinksApi } from '@/services/sendLinks'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { isAmountWithinBalance, isValidSendAmount } from '@/utils/balance.utils'
import { captureNetworkTriagedFailure } from '@/utils/network-triage'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useContext, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { formatUnits, parseUnits, type Address, type Hash } from 'viem'
import { Button } from '@/components/0_Bruddle/Button'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import AmountInput from '../../../Global/AmountInput'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useAddMoneyAction } from '@/features/add-money/drawer/useAddMoneyAction'
import { formatBankAmount } from '@/utils/currency'

// Below the smallest fiat minimum the recipient loses every fiat claim rail
// (bank / Pix / Mercado Pago all reject at claim time) and is left with only
// Peanut-account or wallet claims. Warn the sender here — the claim screen is
// too late, the money is already locked in the link. The warning copy asserts
// that conjunction, which only holds while the per-rail minimums agree — a
// test pins them equal so a divergence forces the copy question.
const MIN_FIAT_CLAIM_AMOUNT = Math.min(...Object.values(CLAIM_RAIL_MINIMUMS))

// The link flow has one screen before its success: a recovery stays on it.
const noView = () => {}

const LinkSendInitialView = () => {
    const t = useTranslations('send')
    const tCommon = useTranslations('common')
    const tLoading = useTranslations('loadingStates')
    const tErrors = useTranslations('errors')
    const tWithdraw = useTranslations('withdraw')
    const tPayment = useTranslations('payment')
    const tAdd = useTranslations('addMoney')
    const tCard = useTranslations('card.addMoney')
    const toFriendlyError = useFriendlyError()
    const {
        attachmentOptions,
        setAttachmentOptions,
        errorState,
        setErrorState,
        tokenValue,
        setTokenValue,
        setLink,
        setView,
    } = useLinkSendFlow()

    const { createLink } = useCreateLink()

    const { setLoadingState, isLoading } = useContext(loadingStateContext)

    const {
        address: walletAddress,
        fetchBalance,
        spendableBalance: balance,
        formattedSpendableBalance,
        spendableBalanceDecimal,
        availableSpendableBalance,
        isSpendableBalanceReady,
        isSpendableBalanceSettled,
    } = useWallet()
    // the live total (smart + Rain), what the spend can route now; undefined until both terms read, so
    // the display cache never passes or blocks an amount. Both gates and the add-money gap read it, as
    // on Send (TASK-25467)
    const liveBalance = isSpendableBalanceReady ? availableSpendableBalance : undefined
    const queryClient = useQueryClient()
    const { hasPendingTransactions } = usePendingTransactions()

    // Displayed total spendable (smart + collateral), single-sourced + formatted
    // by the hook. Empty while loading so we don't flash "$0.00".
    const peanutWalletBalance = useMemo(() => {
        return balance === undefined ? '' : formattedSpendableBalance
    }, [balance, formattedSpendableBalance])

    // Informational only — small links are legitimate (Peanut-account / wallet
    // claims have no minimum), so this never blocks Create link.
    const enteredAmount = parseFloat(tokenValue ?? '')
    const isBelowFiatClaimMinimum = enteredAmount > 0 && enteredAmount < MIN_FIAT_CLAIM_AMOUNT

    // A link whose deposit landed: show it, and register it with the backend.
    const showCreatedLink = useCallback(
        (created: CreatedSendLink) => {
            posthog.capture(ANALYTICS_EVENTS.SEND_LINK_CREATED, {
                amount: tokenValue,
                chain_id: created.chainId,
                token_address: created.tokenAddress,
                has_attachment: !!attachmentOptions?.rawFile,
            })

            setLink(created.link)
            setView('SUCCESS')
            fetchBalance()
            queryClient.invalidateQueries({
                queryKey: [TRANSACTIONS],
            })

            // we dont need to wait for this to finish in order to proceed
            setTimeout(async () => {
                try {
                    await sendLinksApi.create({
                        pubKey: created.pubKey,
                        chainId: created.chainId,
                        txHash: created.txHash,
                        contractVersion: created.contractVersion,
                        depositIdx: created.depositIdx,
                        amount: created.amount,
                        tokenAddress: created.tokenAddress,
                        preparationId: created.preparationId,
                        reference: attachmentOptions?.message,
                        attachment: attachmentOptions?.rawFile,
                        filename: attachmentOptions?.rawFile?.name,
                        mimetype: attachmentOptions?.rawFile?.type,
                    })
                } catch (error) {
                    // we want to capture any errors here because we are already in the background
                    console.error(error)
                    void captureNetworkTriagedFailure(error, {
                        tags: { ...criticalFlowTags('send-link'), send_link_step: 'persist' },
                    })
                }
            }, 0)
        },
        [tokenValue, attachmentOptions, setLink, setView, fetchBalance, queryClient]
    )

    // The double-send guard (usePendingChargeSend): a deposit whose answer was
    // lost is read back from the chain and its link shown, never deposited again.
    const readLinkDeposit = useCallback(async () => ({ state: 'unbooked' as const }), [])
    const showFoundLink = useCallback(
        async ({ chargeId: pubKey }: PendingChargeSend, txHash: Hash) =>
            showCreatedLink(await sendLinkFromFoundDeposit({ pubKey, txHash, sender: walletAddress as Address })),
        [showCreatedLink, walletAddress]
    )
    const showUnknownOutcome = useCallback(
        (unknown: boolean) =>
            setErrorState(
                unknown
                    ? { showError: true, errorMessage: tPayment('confirmingPayment.description') }
                    : { showError: false, errorMessage: '' }
            ),
        [setErrorState, tPayment]
    )
    const pendingSend = usePendingChargeSend({
        intent: 'send-link',
        walletAddress: walletAddress as Address | undefined,
        readOrder: readLinkDeposit,
        recordPayment: showFoundLink,
        canResume: true,
        setIsPaymentStatusUnknown: showUnknownOutcome,
        setCurrentView: noView,
        setError: setErrorState,
    })

    const handleOnNext = useCallback(async () => {
        if (isLoading) return

        // Numeric gate, not string truthiness — "0"/"0.00" are truthy and
        // used to reach createLink as a real zero-value on-chain link.
        if (!tokenValue || !isValidSendAmount(tokenValue)) {
            setErrorState({
                showError: true,
                errorMessage: tWithdraw('errors.invalidAmount'),
                errorCode: 'invalidAmount',
            })
            return
        }

        // Re-check affordability at submit too: the Retry button isn't disabled
        // on a balance error (unlike the other flows), so without this a blocked
        // amount could reach createLink. Only once the live balance has read — else
        // a tap before the queries resolve would false-reject.
        if (liveBalance !== undefined && !isAmountWithinBalance(tokenValue, liveBalance)) {
            setErrorState({
                showError: true,
                errorMessage: tErrors('notEnoughBalanceAddFunds'),
                errorCode: 'notEnoughBalanceAddFunds',
            })
            return
        }

        // A link deposit may still land, or a tap in this tick started one:
        // nothing more is deposited until it is final.
        if (!pendingSend.claim()) return
        try {
            setLoadingState('Loading')

            // clear any previous errors
            setErrorState({ showError: false, errorMessage: '' })

            const created = await createLink(parseUnits(tokenValue, PEANUT_WALLET_TOKEN_DECIMALS), {
                onBegin: (pubKey) => pendingSend.begin(pubKey),
                onBroadcast: pendingSend.onBroadcast,
            })
            pendingSend.clear()
            showCreatedLink(created)
        } catch (error) {
            // Card re-approval dismissed, or the screen left, before the link's
            // deposit was prepared or signed — no link exists and nothing was
            // spent. Control flow, not a failed link creation.
            if (error instanceof SpendRecoveryAbortedError) {
                pendingSend.clear()
                return
            }
            // After the deposit left this device, any failure may hide a link
            // that exists: recovery reads it back, and Retry stays off meanwhile.
            const mayHaveSent = pendingSend.mayHaveSent(error)
            if (!mayHaveSent) pendingSend.clear()

            // handle errors
            const errorString = toFriendlyError(error)
            if (!mayHaveSent) setErrorState({ showError: true, errorMessage: errorString })
            // Tagged, or the noise filters drop it: a send link that dies on a
            // failed fetch matched `networkIssues` in sentry.utils.ts and was
            // silently discarded (TASK-21956). Fire-and-forget: the triage
            // probes may take up to 2.5s and must not hold up `finally`.
            // `error_message` is the LOCALIZED copy the user saw, so it can't be
            // grouped on — error_name/error_raw carry the raw class alongside.
            void captureNetworkTriagedFailure(error, {
                tags: {
                    ...criticalFlowTags('send-link'),
                    send_link_step: 'create',
                    may_have_sent: String(mayHaveSent),
                },
                extra: { amount: tokenValue, hasAttachment: !!attachmentOptions?.rawFile },
                ...(mayHaveSent
                    ? {}
                    : {
                          analytics: {
                              event: ANALYTICS_EVENTS.SEND_LINK_FAILED,
                              props: {
                                  amount: tokenValue,
                                  error_message: errorString,
                                  error_name: error instanceof Error ? error.name : 'unknown',
                                  error_raw: error instanceof Error ? error.message : String(error),
                              },
                          },
                      }),
            })
            if (mayHaveSent) await pendingSend.recover()
        } finally {
            pendingSend.release()
            setLoadingState('Idle')
        }
    }, [
        isLoading,
        tokenValue,
        tWithdraw,
        createLink,
        pendingSend,
        showCreatedLink,
        setLoadingState,
        attachmentOptions,
        setErrorState,
        liveBalance,
        tErrors,
        toFriendlyError,
    ])

    useEffect(() => {
        // skip balance check if transaction is pending
        // (balance may be optimistically updated during transaction)
        // isLoading covers the createLink operation which directly uses handleSendUserOpEncoded
        if (hasPendingTransactions || isLoading) {
            return
        }

        if (liveBalance === undefined || !tokenValue) {
            // An emptied amount is user input — clear everything (a Retry with no
            // amount would be a dead button). A momentarily-unavailable balance is
            // NOT a user action: release only the gate's own error, never a
            // submit-time failure the user hasn't acted on yet.
            if (!tokenValue || errorState?.errorCode === 'notEnoughBalanceAddFunds') {
                setErrorState({ showError: false, errorMessage: '' })
            }
            return
        }
        // Gate on the live total as the user types, as Send does (TASK-25467): "Add $X" shows the real
        // gap before Create link is tapped. Money still in transit fails late with the settling copy.
        if (!isAmountWithinBalance(tokenValue, liveBalance)) {
            // Claim the error slot only when it's free or already ours. A submit-time
            // failure (cooldown / settling copy) must stay until the user retries or
            // edits — right after a collateral spend the polled balance oscillates
            // around the amount boundary, and overwriting here let the recovery
            // branch below clear the swapped-in message, silently swallowing the
            // real error while the user still couldn't spend.
            if (!errorState?.showError || errorState.errorCode === 'notEnoughBalanceAddFunds') {
                setErrorState({
                    showError: true,
                    errorMessage: tErrors('notEnoughBalanceAddFunds'),
                    errorCode: 'notEnoughBalanceAddFunds',
                })
            }
        } else if (errorState?.errorCode === 'notEnoughBalanceAddFunds') {
            // only clear OUR balance-gate error — never wipe a submit-time failure
            // message (e.g. the settling copy) that handleOnNext set on a late failure.
            setErrorState({ showError: false, errorMessage: '' })
        }
    }, [
        liveBalance,
        tokenValue,
        setErrorState,
        hasPendingTransactions,
        isLoading,
        errorState?.showError,
        errorState?.errorCode,
        tErrors,
    ])

    // A changed amount means the previous failure no longer describes what the
    // user is about to submit — hand the error slot back to the balance gate
    // (which immediately re-flags a shortfall on the new amount if there is one).
    const handleAmountChange = useCallback(
        (value: string) => {
            if (value !== tokenValue && errorState?.showError) {
                setErrorState({ showError: false, errorMessage: '' })
            }
            setTokenValue(value)
        },
        [tokenValue, errorState?.showError, setErrorState, setTokenValue]
    )

    // Client-side validation errors carry an errorCode ('invalidAmount' /
    // 'notEnoughBalanceAddFunds') — they render as the amount field's own
    // error. Submit-time failures (createLink, cooldown, settling copy) have
    // no code and stay in the flow-level Callout with the retry CTA.
    const isFieldError =
        !!errorState?.showError &&
        (errorState.errorCode === 'invalidAmount' || errorState.errorCode === 'notEnoughBalanceAddFunds')
    const isFlowError = !!errorState?.showError && !isFieldError

    // a short balance adds the gap in place (TASK-25467), as on Send: the drawer comes back to this URL,
    // amount in it. The gate's own error clears once the balance covers the amount, which turns Create link on.
    const isShort = !!errorState?.showError && errorState.errorCode === 'notEnoughBalanceAddFunds'
    const liveSpendableUsd =
        liveBalance === undefined ? undefined : Number(formatUnits(liveBalance, PEANUT_WALLET_TOKEN_DECIMALS))
    const addMoney = useAddMoneyAction({
        place: 'send_link',
        targetUsd: enteredAmount || 0,
        spendableUsd: liveSpendableUsd,
        balanceSettled: isSpendableBalanceSettled,
        step: `link:${tokenValue ?? ''}`,
        urlState: { amount: tokenValue },
    })
    const bankSent = isShort ? addMoney.bankSent : undefined

    return (
        // ponytail: no wrapper — PageStack.Center's gap-4 owns the spacing
        <>
            <PeanutActionCard type="send" />

            <Field error={isFieldError && !bankSent ? errorState?.errorMessage : undefined} errorTestId="error-alert">
                <AmountInput
                    initialAmount={tokenValue}
                    setPrimaryAmount={handleAmountChange}
                    onSubmit={handleOnNext}
                    walletBalance={peanutWalletBalance}
                    balanceFillAmount={spendableBalanceDecimal}
                />
            </Field>

            <BaseInput
                placeholder={tCommon('comment')}
                value={attachmentOptions.message}
                maxLength={140}
                onChange={(e) => setAttachmentOptions({ ...attachmentOptions, message: e.target.value })}
            />

            {isBelowFiatClaimMinimum && (
                <Callout priority="attention" data-testid="info-card">
                    {t('link.minFiatClaimWarning', { amount: MIN_FIAT_CLAIM_AMOUNT })}
                </Callout>
            )}

            <div className="flex flex-col gap-4">
                {bankSent && (
                    <Callout priority="info" className="w-full" data-testid="send-link-add-money-bank-sent">
                        {bankSent.usd
                            ? tCard('bankSentPending', { amount: formatBankAmount(bankSent.usd, 'USD') })
                            : tCard('bankSentPendingNoAmount')}
                    </Callout>
                )}
                {/* the tertiary sits gap-6 under the primary (design.md tertiary CTA) */}
                <div className="flex flex-col gap-6">
                    {/* only a flow (submit-time) error flips the CTA to retry — a
                        validation error keeps the primary Create link button, and a short
                        balance turns it into "Add $X" until a bank transfer is on its way */}
                    {isFlowError ? (
                        <Button
                            shadowSize="4"
                            icon="retry"
                            onClick={handleOnNext}
                            loading={isLoading || pendingSend.isRecovering}
                            // a deposit that may still land keeps Retry off until it is final
                            disabled={isLoading || pendingSend.isPending}
                        >
                            {tCommon('retry')}
                        </Button>
                    ) : isShort && !bankSent ? (
                        <Button
                            variant="primary"
                            icon="arrow-down"
                            onClick={addMoney.openAddMoney}
                            data-testid="send-link-add-money"
                        >
                            {addMoney.gapUsd
                                ? tAdd('addAmount', { amount: formatBankAmount(addMoney.gapUsd, 'USD') })
                                : tAdd('title')}
                        </Button>
                    ) : (
                        <Button
                            shadowSize="4"
                            onClick={handleOnNext}
                            loading={isLoading}
                            disabled={
                                isLoading ||
                                pendingSend.isPending ||
                                !isValidSendAmount(tokenValue) ||
                                !!errorState?.showError
                            }
                        >
                            {isLoading ? tLoading('creatingLink') : t('link.createLink')}
                        </Button>
                    )}
                    {bankSent && (
                        <LinkButton
                            className="self-center"
                            onClick={addMoney.openAddMoney}
                            data-testid="send-link-add-money-another-way"
                        >
                            {tAdd('anotherWay')}
                        </LinkButton>
                    )}
                </div>
                {addMoney.drawer}
                {isFlowError && (
                    <Callout priority="error" data-testid="error-alert">
                        <CooldownErrorText message={errorState.errorMessage} />
                    </Callout>
                )}
            </div>
        </>
    )
}

export default LinkSendInitialView

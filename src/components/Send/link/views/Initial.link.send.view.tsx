'use client'

import { useCreateLink } from '@/components/Create/useCreateLink'
import { FieldColumn } from '@/components/0_Bruddle/FieldColumn'
import { Notification } from '@/components/0_Bruddle/Notification'
import PeanutActionCard from '@/components/Global/PeanutActionCard'
import { CLAIM_RAIL_MINIMUMS } from '@/constants/payment.consts'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { TRANSACTIONS } from '@/constants/query.consts'
import { loadingStateContext } from '@/context/loadingStates.context'
import { useLinkSendFlow } from '@/context/LinkSendFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { sendLinksApi } from '@/services/sendLinks'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { isAmountWithinBalance, isValidSendAmount } from '@/utils/balance.utils'
import { captureNetworkTriagedFailure } from '@/utils/network-triage'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useContext, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { parseUnits } from 'viem'
import { Button } from '@/components/0_Bruddle/Button'
import FileUploadInput from '../../../Global/FileUploadInput'
import AmountInput from '../../../Global/AmountInput'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

// Below the smallest fiat minimum the recipient loses every fiat claim rail
// (bank / Pix / Mercado Pago all reject at claim time) and is left with only
// Peanut-account or wallet claims. Warn the sender here — the claim screen is
// too late, the money is already locked in the link. The warning copy asserts
// that conjunction, which only holds while the per-rail minimums agree — a
// test pins them equal so a divergence forces the copy question.
const MIN_FIAT_CLAIM_AMOUNT = Math.min(...Object.values(CLAIM_RAIL_MINIMUMS))

const LinkSendInitialView = () => {
    const t = useTranslations('send')
    const tCommon = useTranslations('common')
    const tLoading = useTranslations('loadingStates')
    const tErrors = useTranslations('errors')
    const tWithdraw = useTranslations('withdraw')
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

    const { fetchBalance, spendableBalance: balance, formattedSpendableBalance } = useWallet()
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

    const handleOnNext = useCallback(async () => {
        try {
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
            // amount could reach createLink. Only when the balance has loaded — else
            // a tap before the query resolves would false-reject. Gates on the
            // displayed total; an in-transit shortfall fails late with the settling copy.
            if (balance !== undefined && !isAmountWithinBalance(tokenValue, balance)) {
                setErrorState({
                    showError: true,
                    errorMessage: tErrors('notEnoughBalanceAddFunds'),
                    errorCode: 'notEnoughBalanceAddFunds',
                })
                return
            }

            setLoadingState('Loading')

            // clear any previous errors
            setErrorState({ showError: false, errorMessage: '' })

            const { link, pubKey, chainId, contractVersion, depositIdx, txHash, amount, tokenAddress, preparationId } =
                await createLink(parseUnits(tokenValue!, PEANUT_WALLET_TOKEN_DECIMALS))

            posthog.capture(ANALYTICS_EVENTS.SEND_LINK_CREATED, {
                amount: tokenValue,
                chain_id: chainId,
                token_address: tokenAddress,
                has_attachment: !!attachmentOptions?.rawFile,
            })

            setLink(link)
            setView('SUCCESS')
            fetchBalance()
            queryClient.invalidateQueries({
                queryKey: [TRANSACTIONS],
            })

            // we dont need to wait for this to finish in order to proceed
            setTimeout(async () => {
                try {
                    await sendLinksApi.create({
                        pubKey,
                        chainId,
                        txHash,
                        contractVersion,
                        depositIdx,
                        amount,
                        tokenAddress,
                        preparationId,
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
        } catch (error) {
            // handle errors
            const errorString = toFriendlyError(error)
            setErrorState({ showError: true, errorMessage: errorString })
            // Tagged, or the noise filters drop it: a send link that dies on a
            // failed fetch matched `networkIssues` in sentry.utils.ts and was
            // silently discarded (TASK-21956). Fire-and-forget: the triage
            // probes may take up to 2.5s and must not hold up `finally`.
            // `error_message` is the LOCALIZED copy the user saw, so it can't be
            // grouped on — error_name/error_raw carry the raw class alongside.
            void captureNetworkTriagedFailure(error, {
                tags: { ...criticalFlowTags('send-link'), send_link_step: 'create' },
                extra: { amount: tokenValue, hasAttachment: !!attachmentOptions?.rawFile },
                analytics: {
                    event: ANALYTICS_EVENTS.SEND_LINK_FAILED,
                    props: {
                        amount: tokenValue,
                        error_message: errorString,
                        error_name: error instanceof Error ? error.name : 'unknown',
                        error_raw: error instanceof Error ? error.message : String(error),
                    },
                },
            })
        } finally {
            setLoadingState('Idle')
        }
    }, [
        isLoading,
        tokenValue,
        tWithdraw,
        createLink,
        fetchBalance,
        queryClient,
        setLoadingState,
        attachmentOptions,
        setLink,
        setView,
        setErrorState,
        balance,
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

        if (!peanutWalletBalance || !tokenValue) {
            // An emptied amount is user input — clear everything (a Retry with no
            // amount would be a dead button). A momentarily-unavailable balance is
            // NOT a user action: release only the gate's own error, never a
            // submit-time failure the user hasn't acted on yet.
            if (!tokenValue || errorState?.errorCode === 'notEnoughBalanceAddFunds') {
                setErrorState({ showError: false, errorMessage: '' })
            }
            return
        }
        // Gate on the displayed total: block only a true shortfall. An in-transit
        // amount passes and fails late (settling message + refetch) — the FE balance
        // is ~30s-polled, so blocking it here would over-reject routable funds.
        if (!isAmountWithinBalance(tokenValue, balance)) {
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
        peanutWalletBalance,
        balance,
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
    // no code and stay in the flow-level Notification with the retry CTA.
    const isFieldError =
        !!errorState?.showError &&
        (errorState.errorCode === 'invalidAmount' || errorState.errorCode === 'notEnoughBalanceAddFunds')
    const isFlowError = !!errorState?.showError && !isFieldError

    return (
        <div className="space-y-4 w-full">
            <PeanutActionCard type="send" />

            <FieldColumn error={isFieldError ? errorState?.errorMessage : undefined} errorTestId="error-alert">
                <AmountInput
                    initialAmount={tokenValue}
                    setPrimaryAmount={handleAmountChange}
                    onSubmit={handleOnNext}
                    walletBalance={peanutWalletBalance}
                />
            </FieldColumn>

            <FileUploadInput
                className="h-11"
                placeholder={tCommon('comment')}
                attachmentOptions={attachmentOptions}
                setAttachmentOptions={setAttachmentOptions}
            />

            {isBelowFiatClaimMinimum && (
                <Notification priority="attention" data-testid="info-card">
                    {t('link.minFiatClaimWarning', { amount: MIN_FIAT_CLAIM_AMOUNT })}
                </Notification>
            )}

            <div className="flex flex-col gap-4">
                {/* only a flow (submit-time) error flips the CTA to retry — a
                    validation error keeps the primary Create link button */}
                {isFlowError ? (
                    <Button shadowSize="4" icon="retry" onClick={handleOnNext} loading={isLoading} disabled={isLoading}>
                        {tCommon('retry')}
                    </Button>
                ) : (
                    <Button
                        shadowSize="4"
                        onClick={handleOnNext}
                        loading={isLoading}
                        disabled={isLoading || !isValidSendAmount(tokenValue) || !!errorState?.showError}
                    >
                        {isLoading ? tLoading('creatingLink') : t('link.createLink')}
                    </Button>
                )}
                {isFlowError && (
                    <Notification priority="error" data-testid="error-alert">
                        {errorState.errorMessage}
                    </Notification>
                )}
            </div>
        </div>
    )
}

export default LinkSendInitialView

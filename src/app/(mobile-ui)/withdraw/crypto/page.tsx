'use client'

import ActionModal from '@/components/Global/ActionModal'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import AddressLink from '@/components/Global/AddressLink'
import Loading from '@/components/Global/Loading'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import ConfirmWithdrawView from '@/features/withdraw/views/ConfirmWithdrawView'
import InitialWithdrawView from '@/features/withdraw/views/InitialWithdrawView'
import { useWithdrawFlow } from '@/features/withdraw/WithdrawFlowContext'
import { useWithdrawAmount } from '@/features/withdraw/useWithdrawAmount'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import { WITHDRAW_CRYPTO_STEPS, type WithdrawData } from '@/features/withdraw/types'
import { cryptoStepGuards } from '@/features/withdraw/step-guards'
import { validateCryptoWithdrawAmount } from '@/features/withdraw/amount-validation'
import { useWallet } from '@/hooks/wallet/useWallet'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import type {
    CreateChargeRequest,
    CreateRequestRequest as CreateRequestPayloadServices,
    TCharge,
    TRequestResponse,
} from '@/services/services.types'
import { NATIVE_TOKEN_ADDRESS } from '@/utils/token.utils'
import { isWithdrawFeeDisproportionate, getMinWithdrawUsdForChain } from '@/utils/cross-chain-fee.utils'
import { isAmountWithinBalance } from '@/utils/balance.utils'
import { isBelowRhinoMinDeposit } from '@/utils/withdraw.utils'
import * as peanutInterfaces from '@/interfaces/peanut-sdk-types'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { captureMessage } from '@sentry/nextjs'
import { captureNetworkTriagedFailure } from '@/utils/network-triage'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import type { Address, Hex, TransactionReceipt } from 'viem'
import { parseUnits } from 'viem'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useCrossChainTransfer } from '@/features/payments/shared/hooks/useCrossChainTransfer'
import { usePaymentRecorder } from '@/features/payments/shared/hooks/usePaymentRecorder'
import { isTxReverted, printableAddress, validateEnsName } from '@/utils/general.utils'
import { appBaseUrl } from '@/utils/url.utils'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useTranslations } from 'next-intl'
import { resolveSettledTxHash } from '@/utils/settled-tx-hash.utils'
import { toError } from '@/utils/to-error'

export default function WithdrawCryptoPage() {
    const router = useRouter()
    const t = useTranslations('withdraw')
    const tCommon = useTranslations('common')
    const tErrors = useTranslations('errors')
    const tNav = useTranslations('navigation')
    const toFriendlyError = useFriendlyError()
    // Send → Exchange or Wallet lands here as /withdraw/crypto?method=crypto.
    // Every back/redirect target below keeps the marker, or the amount step it
    // returns to silently reverts to withdraw copy.
    // Forward the marker verbatim rather than assuming crypto: entering as
    // /withdraw?method=bank and then picking Crypto lands here as method=bank,
    // and rewriting it to crypto would change the amount step's back behaviour.
    // step=amount lands on the amount screen directly — the root stepper's
    // guard falls back to method selection if the flow memory is gone.
    const { isFromSendFlow, sendFlowMethod } = useSendFlowOrigin()
    const amountStepHref = isFromSendFlow ? `/withdraw?step=amount&method=${sendFlowMethod}` : '/withdraw?step=amount'
    const onBack = useSafeBack(amountStepHref)
    const { address, sendTransactions, sendMoney, spendableBalance } = useWallet()
    const { resetTokenContextProvider } = useContext(tokenSelectorContext)
    const {
        withdrawData,
        setWithdrawData,
        showCompatibilityModal,
        setShowCompatibilityModal,
        isPreparingReview,
        setIsPreparingReview,
        paymentError,
        setPaymentError,
        setError: setWithdrawError,
        chargeDetails,
        setChargeDetails,
        transactionHash,
        setTransactionHash,
        paymentDetails,
        setPaymentDetails,
        setRecipient,
        setIsValidRecipient,
        recipient,
    } = useWithdrawFlow()

    // the one typed amount (USD), carried in the URL from the shared amount step
    const [amountToWithdraw] = useWithdrawAmount()
    const usdAmount = amountToWithdraw

    // recipient → review → success as named screen ids in the URL. The guards
    // cover refresh/deep-link into a step whose prepared state (charge, route)
    // did not survive — and the success step additionally demands EXECUTION
    // proof (the broadcast transaction identifier), so a hand-edited
    // ?step=success can never render a success screen for a transfer that
    // never ran (Chip review, PR #2917).
    const stepper = useFlowStepper({
        steps: WITHDRAW_CRYPTO_STEPS,
        guards: cryptoStepGuards({
            prepared: !!(chargeDetails && withdrawData),
            executed: !!transactionHash,
        }),
    })

    // hooks for route calculation and payment recording
    const {
        transactions,
        receiveAmount,
        payAmount,
        feeUsd,
        minDepositLimitUsd,
        isCalculating,
        isXChain,
        isDiffToken,
        error: routeError,
        calculate: calculateRoute,
        reset: resetRouteCalculation,
    } = useCrossChainTransfer()

    const { isRecording, error: recordError, recordPayment, reset: resetPaymentRecorder } = usePaymentRecorder()

    // Once the on-chain leg has broadcast for a charge, Retry must NEVER
    // broadcast again — a recordPayment failure after the spend used to
    // re-run the whole flow and issue a second on-chain transfer
    // (TASK-19581 double-spend). Stamped the moment a tx identifier
    // exists; a retry for the same charge replays only the record.
    const executedSpendRef = useRef<{
        chargeId: string
        txHash: Hex
        minedTxHash: Hex | undefined
        strategy: 'collateral-only' | 'smart-only' | 'mixed' | undefined
    } | null>(null)

    // The USD amount the request/charge rows were created for, pinned to the
    // charge id. The confirm leg broadcasts THIS, not the still-editable
    // `?amount=` — otherwise an edit between review and confirm moves a
    // different amount on-chain than the records say (Chip review round 4).
    const setupAmountRef = useRef<{ chargeId: string; amountUsd: string } | null>(null)

    const { triggerHaptic } = useAppHaptic()

    // local state for transaction execution
    const [isSendingTx, setIsSendingTx] = useState(false)
    // The USD amount the executed withdrawal actually moved (the charge-pinned
    // broadcast amount). The success screen and the completion analytics read
    // THIS — `?amount=` stays user-editable after execution, and rendering it
    // would let a URL edit forge the receipt (Chip round 7).
    const [executedAmountUsd, setExecutedAmountUsd] = useState<string | null>(null)

    // combined processing state
    const isProcessing = useMemo(() => isSendingTx || isRecording, [isSendingTx, isRecording])

    // helper to manage errors consistently
    const setError = useCallback(
        (error: string | null) => {
            setPaymentError(error)
            // also set the withdraw flow error state for display in InitialWithdrawView
            setWithdrawError({
                showError: !!error,
                errorMessage: error || '',
            })
        },
        [setPaymentError, setWithdrawError]
    )

    const clearErrors = useCallback(() => {
        setError(null)
    }, [setError])

    // reset on mount
    useEffect(() => {
        setChargeDetails(null)
        setTransactionHash(null)
        setPaymentDetails(null)
        resetRouteCalculation()
        resetPaymentRecorder()
    }, [setChargeDetails, setTransactionHash, setPaymentDetails, resetRouteCalculation, resetPaymentRecorder])

    // clear errors when amount changes
    useEffect(() => {
        if (amountToWithdraw) {
            clearErrors()
            setChargeDetails(null)
        }
    }, [amountToWithdraw, clearErrors, setChargeDetails])

    // propagate route/record errors
    useEffect(() => {
        const error = routeError || recordError
        if (error) {
            setPaymentError(error)
        }
    }, [routeError, recordError, setPaymentError])

    // prepare transaction when entering the review step
    useEffect(() => {
        if (stepper.step === 'review' && chargeDetails && withdrawData && address) {
            calculateRoute({
                source: {
                    address: address as Address,
                    tokenAddress: PEANUT_WALLET_TOKEN as Address,
                    chainId: PEANUT_WALLET_CHAIN.id.toString(),
                    // USD-denominated; source token is USDC (1:1). Required for
                    // the bridge path's 'pay' mode (cross-chain ETH/etc). Pinned
                    // to the amount the charge was created for — the URL param
                    // stays editable and must not re-route the quote.
                    tokenAmount:
                        setupAmountRef.current?.chargeId === chargeDetails.uuid
                            ? setupAmountRef.current.amountUsd
                            : amountToWithdraw,
                },
                destination: {
                    recipientAddress: chargeDetails.requestLink.recipientAddress as Address,
                    tokenAddress: chargeDetails.tokenAddress as Address,
                    tokenAmount: chargeDetails.tokenAmount,
                    tokenDecimals: chargeDetails.tokenDecimals,
                    tokenType: Number(chargeDetails.tokenType),
                    chainId: chargeDetails.chainId,
                },
                context: 'withdraw',
                contextId: chargeDetails.uuid,
                senderPeanutWalletAddress: address as Address,
                skipGasEstimate: true, // peanut wallet handles gas
            })
        }
    }, [stepper.step, chargeDetails, withdrawData, calculateRoute, address, amountToWithdraw])

    const handleSetupReview = useCallback(
        async (data: Omit<WithdrawData, 'amount'>) => {
            if (!amountToWithdraw) {
                console.error('Amount to withdraw is not set or not available from context')
                setError(t('errors.amountMissing'))
                return
            }

            // `?amount=` is user-editable URL text — validate and normalize it
            // BEFORE any request/charge is persisted (Chip review round 4):
            // finite, positive, plain-decimal, within the loaded balance.
            // Same-chain USDC has no rail minimum, so `0` and malformed values
            // used to sail past the Rhino-only minimum check below and persist
            // request+charge records that could never sign.
            const amountCheck = validateCryptoWithdrawAmount(amountToWithdraw, spendableBalance)
            if (!amountCheck.ok) {
                setError(
                    amountCheck.reason === 'insufficientBalance'
                        ? tErrors('notEnoughBalanceAddFunds')
                        : amountCheck.reason === 'balanceLoading'
                          ? t('errors.prepareFailed')
                          : t('errors.invalidAmount')
                )
                return
            }
            const amountUsd = amountCheck.normalized

            // Same-chain USDC is a direct transfer — no Rhino, no minimum
            // (parity with send-via-link). Every other destination/token rides
            // Rhino, which parks (doesn't auto-refund) deposits below the route
            // minimum — block those before any request/charge is created.
            // amountToWithdraw is USD.
            const isSameChainUsdc =
                data.chain.chainId.toString() === PEANUT_WALLET_CHAIN.id.toString() &&
                data.token.address.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase()
            if (!isSameChainUsdc) {
                const usdToWithdraw = parseFloat(amountUsd)
                const minUsd = getMinWithdrawUsdForChain(data.chain.chainId)
                if (!Number.isFinite(usdToWithdraw) || usdToWithdraw < minUsd) {
                    const minDisplay = minUsd % 1 === 0 ? `$${minUsd}` : `$${minUsd.toFixed(2)}`
                    setError(
                        `Withdrawals to ${data.chain.networkName} need at least ${minDisplay}. Increase the amount or pick a different network.`
                    )
                    return
                }
            }

            clearErrors()
            setChargeDetails(null)
            // a NEW attempt invalidates the previous one's execution proof —
            // without this, ?step=success re-renders the old success screen
            // while the new attempt is mid-flight (Chip round 7)
            setTransactionHash(null)
            setExecutedAmountUsd(null)
            setIsPreparingReview(true)

            try {
                // AmountInput's primary denomination is USD ($), so amountToWithdraw
                // is the USD value the user typed. Convert to destination token
                // units before persisting the request/charge — otherwise meta
                // ends up with `tokenAmount: "1"` + `tokenSymbol: "ETH"` and
                // history renders "1 ETH" for what was actually a $1 withdraw.
                const usdValue = parseFloat(amountUsd)
                const tokenPrice = data.token.price ?? 0
                const destinationTokenAmount =
                    tokenPrice > 0 ? (usdValue / tokenPrice).toFixed(Number(data.token.decimals)) : amountUsd

                const completeWithdrawData = { ...data, amount: destinationTokenAmount }
                setWithdrawData(completeWithdrawData)
                const apiRequestPayload: CreateRequestPayloadServices = {
                    recipientAddress: completeWithdrawData.address,
                    chainId: completeWithdrawData.chain.chainId.toString(),
                    tokenAddress: completeWithdrawData.token.address,
                    tokenType: String(
                        completeWithdrawData.token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
                            ? peanutInterfaces.EPeanutLinkType.native
                            : peanutInterfaces.EPeanutLinkType.erc20
                    ),
                    tokenAmount: destinationTokenAmount,
                    tokenDecimals: completeWithdrawData.token.decimals.toString(),
                    tokenSymbol: completeWithdrawData.token.symbol,
                }
                const newRequest: TRequestResponse = await requestsApi.create(apiRequestPayload)

                if (!newRequest || !newRequest.uuid) {
                    throw new Error(t('errors.requestFailed'))
                }

                const recipientEnsName = recipient.name?.trim().toLowerCase()
                const chargePayload: CreateChargeRequest = {
                    pricing_type: 'fixed_price',
                    local_price: { amount: usdValue.toString(), currency: 'USD' },
                    baseUrl: appBaseUrl(),
                    requestId: newRequest.uuid,
                    requestProps: {
                        chainId: completeWithdrawData.chain.chainId.toString(),
                        tokenAmount: destinationTokenAmount,
                        tokenAddress: completeWithdrawData.token.address,
                        tokenType:
                            completeWithdrawData.token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
                                ? peanutInterfaces.EPeanutLinkType.native
                                : peanutInterfaces.EPeanutLinkType.erc20,
                        tokenSymbol: completeWithdrawData.token.symbol,
                        tokenDecimals: Number(completeWithdrawData.token.decimals),
                        recipientAddress: completeWithdrawData.address,
                        // Withdrawing to a name is still paying at one, and the
                        // input keeps the name that produced this address.
                        ...(validateEnsName(recipientEnsName) ? { recipientEnsName } : {}),
                    },
                    transactionType: 'WITHDRAW',
                }
                const createdCharge: TCharge = await chargesApi.create(chargePayload)

                if (!createdCharge || !createdCharge.data || !createdCharge.data.id) {
                    throw new Error(t('errors.chargeFailed'))
                }

                const fullChargeDetails = await chargesApi.get(createdCharge.data.id)

                // the confirm leg broadcasts the amount these records were
                // created for — never re-read from the editable URL
                setupAmountRef.current = { chargeId: fullChargeDetails.uuid, amountUsd }

                setChargeDetails(fullChargeDetails)
                setShowCompatibilityModal(true)
            } catch (err) {
                console.error('Error during setup review (request/charge creation):', err)
                const errorMessage = err instanceof Error && err.message ? err.message : t('errors.prepareFailed')
                setError(errorMessage)
            } finally {
                setIsPreparingReview(false)
            }
        },
        [
            amountToWithdraw,
            spendableBalance,
            clearErrors,
            setChargeDetails,
            setTransactionHash,
            setIsPreparingReview,
            setWithdrawData,
            setShowCompatibilityModal,
            setError,
            recipient,
            t,
            tErrors,
        ]
    )

    const handleCompatibilityProceed = useCallback(() => {
        setShowCompatibilityModal(false)
        if (chargeDetails && withdrawData) {
            void stepper.goTo('review')
        } else {
            console.error('Proceeding to confirm, but charge details or withdraw data are missing.')
            setError(t('errors.confirmDetailsFailed'))
        }
    }, [chargeDetails, withdrawData, stepper, setShowCompatibilityModal, setError, t])

    // True when the withdraw needs a Rhino path (SDA or bridge swap) rather
    // than a direct USDC transfer. Crosses a chain boundary OR a token
    // boundary — `isCrossChainWithdrawal` historically only checked chains,
    // which silently downgraded cross-token same-chain (USDC → ETH on Arb)
    // to a plain USDC.transfer to the recipient.
    const isCrossChainWithdrawal = useMemo<boolean>(() => {
        if (!withdrawData || !chargeDetails) return false
        return isXChain || isDiffToken
    }, [withdrawData, chargeDetails, isXChain, isDiffToken])

    const handleConfirmWithdrawal = useCallback(async () => {
        if (!chargeDetails || !withdrawData || !amountToWithdraw || !address) {
            console.error('Withdraw data, active charge details, or amount missing for final confirmation')
            setError(t('errors.essentialInfoMissing'))
            return
        }

        if (!transactions || transactions.length === 0) {
            console.error('No transactions prepared for withdrawal')
            setError(t('errors.txNotPrepared'))
            return
        }

        // Broadcast the amount the charge was created for (pinned at setup) —
        // `?amount=` stays editable between review and confirm, and re-reading
        // it here would move a different amount on-chain than the records say.
        // Re-validate it against the LIVE balance right before the money moves
        // (Chip review round 4). The record-only replay path is exempt: funds
        // already moved for that charge and only the bookkeeping replays.
        const pinnedAmount =
            setupAmountRef.current?.chargeId === chargeDetails.uuid ? setupAmountRef.current.amountUsd : null
        let broadcastAmount = pinnedAmount ?? amountToWithdraw
        if (executedSpendRef.current?.chargeId !== chargeDetails.uuid) {
            const amountCheck = validateCryptoWithdrawAmount(broadcastAmount, spendableBalance)
            if (!amountCheck.ok) {
                setError(
                    amountCheck.reason === 'insufficientBalance'
                        ? tErrors('notEnoughBalanceAddFunds')
                        : amountCheck.reason === 'balanceLoading'
                          ? t('errors.prepareFailed')
                          : t('errors.invalidAmount')
                )
                return
            }
            broadcastAmount = amountCheck.normalized
        }

        clearErrors()
        setIsSendingTx(true)

        posthog.capture(ANALYTICS_EVENTS.WITHDRAW_CONFIRMED, {
            amount_usd: usdAmount,
            method_type: 'crypto',
        })

        try {
            // For same-chain + same-token withdraws, useCrossChainTransfer
            // produces a single `usdc.transfer(recipient, amount)` call. Route
            // through sendMoney instead of sendTransactions so `useSpendBundle`
            // can take the collateral-only path (directTransfer=true straight
            // to the external recipient — no smart-account hop). Cross-chain
            // goes through Rhino SDA on the kernel, so it stays on the
            // sendTransactions mixed path.
            let finalTxHash: Hex | undefined
            let receipt: TransactionReceipt | null = null
            let minedTxHash: Hex | undefined
            // 'collateral-only' | 'smart-only' | 'mixed' — how the spend was
            // funded; drives how strictly the recordPayment result is treated
            // (see the recordPayment note below).
            let strategy: 'collateral-only' | 'smart-only' | 'mixed' | undefined

            const executedSpend =
                executedSpendRef.current?.chargeId === chargeDetails.uuid ? executedSpendRef.current : null
            if (executedSpend) {
                // A previous attempt already moved funds for this charge and
                // failed at bookkeeping — replay ONLY the record.
                finalTxHash = executedSpend.txHash
                minedTxHash = executedSpend.minedTxHash
                strategy = executedSpend.strategy
                captureMessage('withdraw: retry with executed spend — record-only, skipping broadcast', {
                    level: 'info',
                    extra: { chargeId: chargeDetails.uuid, txHash: finalTxHash, strategy },
                })
            } else if (!isCrossChainWithdrawal) {
                const {
                    userOpHash,
                    txHash,
                    receipt: r,
                    strategy: s,
                } = await sendMoney(withdrawData.address as Address, broadcastAmount, {
                    kind: 'CRYPTO_WITHDRAW',
                    // Lets the backend settle the charge directly when the spend
                    // routes through Rain card collateral (collateral-only): the
                    // charge intent becomes the withdrawal preparation and
                    // /submit completes it server-side. Without this the charge
                    // rots PENDING and the successful withdrawal never shows in
                    // Activity (same contract as direct-send / request-pay).
                    chargeId: chargeDetails.uuid,
                })
                receipt = r
                strategy = s
                if (receipt !== null && isTxReverted(receipt)) {
                    throw new Error(`Transaction failed (reverted). Hash: ${receipt.transactionHash}`)
                }
                finalTxHash = resolveSettledTxHash({ receipt, userOpHash, txHash }, 'withdraw-crypto').hash as Hex
            } else {
                // payAmount is the USDC the kernel actually needs on-hand to execute
                // the first tx — principal + Rhino fee on the SDA path (mode='receive'),
                // principal on the bridge path. Passing the principal alone here
                // under-funds the mixed-strategy collateral sweep and the subsequent
                // transfer reverts with `ERC20: transfer amount exceeds balance`.
                const sourceUsdcAmount = payAmount ?? usdAmount.toString()
                const requiredUsdcAmount = parseUnits(sourceUsdcAmount, PEANUT_WALLET_TOKEN_DECIMALS)
                const txResult = await sendTransactions(transactions, {
                    chainId: PEANUT_WALLET_CHAIN.id.toString(),
                    requiredUsdcAmount,
                    kind: 'CRYPTO_WITHDRAW',
                })
                receipt = txResult.receipt
                strategy = txResult.strategy
                if (receipt !== null && isTxReverted(receipt)) {
                    throw new Error(`Transaction failed (reverted). Hash: ${receipt.transactionHash}`)
                }
                finalTxHash = resolveSettledTxHash({ receipt, userOpHash: txResult.userOpHash }, 'withdraw-crypto')
                    .hash as Hex
            }

            if (!finalTxHash) throw new Error('Withdrawal returned no transaction identifier')

            // Funds are (or are about to be) moving on-chain — from here on,
            // any failure must retry as record-only, never as a re-broadcast.
            minedTxHash ??= receipt?.transactionHash as Hex | undefined
            executedSpendRef.current = { chargeId: chargeDetails.uuid, txHash: finalTxHash, minedTxHash, strategy }

            // Record the payment against the charge on EVERY path — completing
            // the user-facing charge is what makes the withdrawal appear in
            // Activity:
            //  - collateral-only: /prepare tagged the charge (chargeId above)
            //    and /submit completed it server-side; recordPayment re-enters
            //    the same trusted-completion path (idempotent) — the designed
            //    recovery net when /submit's post-mining bookkeeping fails.
            //  - mixed: the kernel sent a plain usdc.transfer(recipient) that
            //    the on-chain validator matches — the normal recordPayment path.
            //  - smart-only / cross-chain: unchanged — recordPayment has always
            //    been their only charge-completion trigger.
            // This used to be SKIPPED for collateral-routed same-chain
            // withdraws, which left the charge PENDING forever: history hides
            // never-paid charges as abandoned drafts and hides the rain-prepare
            // intent as a phantom, so a successful withdrawal was completely
            // invisible in Activity while the balance dropped.
            const routedThroughCollateral = strategy === 'collateral-only' || strategy === 'mixed'
            const collateralRoutedSameChain = routedThroughCollateral && !isCrossChainWithdrawal

            // An untagged mixed same-chain charge goes through the on-chain
            // validator, which needs a MINED tx hash — a userOp hash can never
            // match, and validator retry-exhaustion would flip the successful
            // withdrawal to FAILED (worse than the pre-fix stuck-PENDING). If
            // the receipt wait timed out, skip the record (pre-fix behavior)
            // and leave a breadcrumb. collateral-only is safe regardless: its
            // hash is a backend-broadcast EVM tx and the tagged charge settles
            // via the trusted path.
            const mixedWithoutMinedHash = strategy === 'mixed' && !isCrossChainWithdrawal && !minedTxHash

            let payment: Awaited<ReturnType<typeof recordPayment>> | null = null
            if (mixedWithoutMinedHash) {
                captureMessage('withdraw: skipping recordPayment — mixed spend without mined receipt', {
                    level: 'warning',
                    extra: { chargeId: chargeDetails.uuid, userOpOrTxHash: finalTxHash, strategy },
                })
            } else {
                try {
                    payment = await recordPayment({
                        chargeId: chargeDetails.uuid,
                        chainId: PEANUT_WALLET_CHAIN.id.toString(),
                        txHash: finalTxHash,
                        tokenAddress: PEANUT_WALLET_TOKEN as Address,
                        payerAddress: address as Address,
                    })
                } catch (err) {
                    // Funds already moved on-chain. On collateral-routed same-chain
                    // paths a recordPayment hiccup must not read as a failed
                    // withdrawal (collateral-only is already settled server-side;
                    // mixed then just stays PENDING, exactly like pre-fix) —
                    // degrade to the success view without payment details. Other
                    // paths keep throwing, as they always have.
                    if (!collateralRoutedSameChain) throw err
                    console.error('recordPayment failed after collateral-routed withdrawal (funds moved):', err)
                    captureMessage('withdraw: recordPayment failed after collateral-routed spend', {
                        level: 'warning',
                        extra: { chargeId: chargeDetails.uuid, txHash: finalTxHash, strategy },
                    })
                }
            }

            executedSpendRef.current = null
            setTransactionHash(finalTxHash)
            setExecutedAmountUsd(broadcastAmount)
            setPaymentDetails(payment)
            triggerHaptic()
            void stepper.goTo('success')
            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_COMPLETED, {
                // the amount that moved, not the still-editable URL param
                amount_usd: broadcastAmount,
                method_type: 'crypto',
            })
        } catch (err) {
            console.error('Withdrawal execution failed:', toError(err))
            const errMsg = toFriendlyError(err)
            // Reported here rather than left to the console-capture integration,
            // which the noise filters then drop: a crypto withdrawal dying was
            // leaving no queryable Sentry record at all, and `error_message` is
            // the LOCALIZED copy so it can't be grouped on (TASK-21956).
            void captureNetworkTriagedFailure(err, {
                tags: { ...criticalFlowTags('withdraw-crypto'), withdraw_step: 'execute' },
                extra: { chargeId: chargeDetails?.uuid, usdAmount },
                analytics: {
                    event: ANALYTICS_EVENTS.WITHDRAW_FAILED,
                    props: {
                        method_type: 'crypto',
                        error_message: errMsg,
                        error_name: err instanceof Error ? err.name : 'unknown',
                        error_raw: err instanceof Error ? err.message : String(err),
                    },
                },
            })
            setError(errMsg)
        } finally {
            setIsSendingTx(false)
        }
    }, [
        chargeDetails,
        withdrawData,
        amountToWithdraw,
        spendableBalance,
        address,
        transactions,
        payAmount,
        usdAmount,
        sendTransactions,
        sendMoney,
        isCrossChainWithdrawal,
        recordPayment,
        stepper,
        setTransactionHash,
        setPaymentDetails,
        clearErrors,
        setError,
        triggerHaptic,
        t,
        tErrors,
        toFriendlyError,
    ])

    const handleBackFromConfirm = useCallback(() => {
        void stepper.goTo('recipient')
        clearErrors()
        setChargeDetails(null)
    }, [stepper, clearErrors, setChargeDetails])

    // Clear crypto-TRANSIENT flow memory when this page unmounts (charge,
    // route, recipient, token selection) — on unmount rather than in the
    // success view's onComplete to avoid a race with the '/home' navigation
    // from "Back to home". Deliberately NOT resetWithdrawFlow(): back from the
    // recipient screen is an intra-/withdraw transition, and nuking
    // selectedMethod here made the root amount guard bounce that back-nav to
    // method selection instead of the amount step (Chip review, PR #2917).
    // Leaving /withdraw entirely unmounts the provider, which clears the rest.
    useEffect(() => {
        return () => {
            resetRouteCalculation()
            resetPaymentRecorder()
            resetTokenContextProvider() // reset token selector context to make sure previously selected token is not cached
            setWithdrawData(null)
            setChargeDetails(null)
            setTransactionHash(null)
            setPaymentDetails(null)
            setRecipient({ address: '', name: '' })
            setIsValidRecipient(false)
            setPaymentError(null)
            setWithdrawError({ showError: false, errorMessage: '' })
            setShowCompatibilityModal(false)
        }
    }, [
        resetRouteCalculation,
        resetPaymentRecorder,
        resetTokenContextProvider,
        setWithdrawData,
        setChargeDetails,
        setTransactionHash,
        setPaymentDetails,
        setRecipient,
        setIsValidRecipient,
        setPaymentError,
        setWithdrawError,
        setShowCompatibilityModal,
    ])

    // Display payment errors first (user actions), then route errors (system limitations)
    const displayError = paymentError

    // Get network fee from Rhino preview. Under SDA the fee is a transparent
    // bridge-fee in USD — no slippage distinction.
    const networkFee = useMemo<number>(() => feeUsd ?? 0, [feeUsd])

    // Non-blocking heads-up when the bridge fee is a large share of the amount
    // (flat mainnet gas dominating a small withdraw). The user can still proceed
    // — the fee is shown honestly; we just flag it so a tiny mainnet withdrawal
    // isn't a silent footgun. See cross-chain-fee.utils.ts.
    const showHighFeeWarning = useMemo<boolean>(
        () => isCrossChainWithdrawal && isWithdrawFeeDisproportionate(networkFee, parseFloat(usdAmount)),
        [isCrossChainWithdrawal, networkFee, usdAmount]
    )

    // Pre-sign affordability gate for cross-chain. The input-time gate only
    // checked the principal, but the kernel must spend principal + bridge fee
    // (`payAmount`), so a withdraw that fit the balance at input can fall short
    // here once the fee is known — and the send would surface the misleading
    // "balance isn't fully available yet" (settling) error instead of an honest
    // "not enough balance". Block it here with the right message. Only once the
    // quote has resolved `payAmount` (skipped while calculating; CTA is disabled
    // by isCalculating anyway).
    const insufficientForFee = useMemo<boolean>(
        () =>
            isCrossChainWithdrawal &&
            payAmount != null &&
            spendableBalance !== undefined &&
            !isAmountWithinBalance(payAmount, spendableBalance),
        [isCrossChainWithdrawal, payAmount, spendableBalance]
    )

    // Rhino accepts SDA deposits below the route minimum on-chain but never
    // bridges them — funds strand at the SDA, uncredited. Block the CTA before
    // the user signs. Same-chain USDC transfers have no minimum.
    const belowMinimumMessage = useMemo<string | null>(
        () =>
            isCrossChainWithdrawal && isBelowRhinoMinDeposit(payAmount, minDepositLimitUsd)
                ? `The minimum withdrawal to this network is $${minDepositLimitUsd}. Enter a larger amount.`
                : null,
        [isCrossChainWithdrawal, payAmount, minDepositLimitUsd]
    )

    // Redirect to main withdraw page for amount input. The push must run in an
    // effect — navigating during render is a React violation ("Cannot update
    // Router while rendering WithdrawCryptoPage") that hard-errors the Next 16
    // dev overlay on direct entry/refresh of this route.
    // Guard against the success step: it must stay rendered while the "Back to
    // home" navigation is in flight.
    const needsAmountRedirect = !amountToWithdraw && stepper.step !== 'success'
    useEffect(() => {
        if (needsAmountRedirect) router.push(amountStepHref)
    }, [needsAmountRedirect, router, amountStepHref])

    if (needsAmountRedirect) {
        return <Loading variant="mascot" />
    }

    return (
        <div className="mx-auto flex min-h-[inherit] w-full max-w-md flex-col gap-4 self-center">
            {stepper.step === 'recipient' && (
                <InitialWithdrawView
                    amount={usdAmount}
                    onReview={handleSetupReview}
                    onBack={onBack}
                    isProcessing={isPreparingReview}
                    isFromSendFlow={isFromSendFlow}
                />
            )}

            {stepper.step === 'review' && withdrawData && chargeDetails && (
                <ConfirmWithdrawView
                    amount={usdAmount}
                    token={withdrawData.token}
                    chain={withdrawData.chain}
                    toAddress={withdrawData.address}
                    onConfirm={handleConfirmWithdrawal}
                    onBack={handleBackFromConfirm}
                    isProcessing={isProcessing}
                    error={displayError}
                    networkFee={networkFee}
                    isCrossChain={isCrossChainWithdrawal}
                    isCalculating={isCalculating}
                    receiveAmount={receiveAmount}
                    payAmount={payAmount}
                    showHighFeeWarning={showHighFeeWarning}
                    insufficientBalance={insufficientForFee}
                    belowMinimumMessage={belowMinimumMessage}
                    isFromSendFlow={isFromSendFlow}
                />
            )}

            {stepper.step === 'success' && withdrawData && chargeDetails && (
                <>
                    <PaymentSuccessView
                        headerTitle={isFromSendFlow ? tNav('send') : tNav('withdraw')}
                        recipientType="ADDRESS"
                        type="SEND"
                        amount={executedAmountUsd ?? usdAmount}
                        // Stays true even from the send flow: it also suppresses the
                        // recipient render (no recipientName is passed here) and picks
                        // the "to" prefix, both correct for a send to an address.
                        // Only the title needs the send framing.
                        isWithdrawFlow={true}
                        isFromSendFlow={isFromSendFlow}
                        redirectTo="/home"
                        chargeDetails={chargeDetails}
                        paymentDetails={paymentDetails}
                        usdAmount={executedAmountUsd ?? usdAmount}
                        message={
                            <AddressLink
                                className="text-body-s font-normal text-foreground-secondary no-underline"
                                address={withdrawData.address}
                            />
                        }
                    />
                </>
            )}

            <ActionModal
                visible={showCompatibilityModal}
                onClose={() => {
                    if (isPreparingReview) return
                    setShowCompatibilityModal(false)
                }}
                preventClose={isPreparingReview}
                title={t('compatibilityModal.title')}
                description={
                    <div className="space-y-2">
                        <p>{t('compatibilityModal.description')}</p>
                        {/* Show the concrete destination so the user confirms a real
                            address, not an abstract warning — for ENS recipients this
                            is the first time the resolved address is visible. */}
                        {!!withdrawData?.address && (
                            <p>
                                {t('compatibilityModal.sendingTo')}{' '}
                                <span className="font-mono font-medium text-foreground-primary dark:text-foreground-inverse">
                                    {printableAddress(withdrawData.address)}
                                </span>
                            </p>
                        )}
                    </div>
                }
                icon="alert"
                footer={
                    <div className="w-full">
                        <SlideToConfirm label={tCommon('slideToProceed')} onConfirm={handleCompatibilityProceed} />
                    </div>
                }
            />
        </div>
    )
}

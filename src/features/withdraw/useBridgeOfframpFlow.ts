'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'
import { useWallet } from '@/hooks/wallet/useWallet'
import { SpendRecoveryAbortedError } from '@/hooks/wallet/signSpendRetry'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { isTxReverted } from '@/utils/general.utils'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { isAmountWithinBalance } from '@/utils/balance.utils'
import { getBridgeChainName } from '@/utils/bridge-accounts.utils'
import { getOfframpConfigFromAccount, getCountryFromPath, railJurisdictionForBank } from '@/utils/bridge.utils'
import { createOfframp, confirmOfframp } from '@/app/actions/offramp'
import { API_ERROR_CODES, ApiError } from '@/services/api-error'
import { useAuth } from '@/context/authContext'
import { useTosGuard } from '@/hooks/useTosGuard'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useWaitingOnProviderModal } from '@/hooks/useWaitingOnProviderModal'
import { useEeaUpliftFunnel } from '@/hooks/useEeaUpliftFunnel'
import { headsUpDeadline } from '@/utils/bridge-tasks.utils'
import { upliftTriggerFromGate } from '@/utils/eea-uplift.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { isVerifiableGate } from '@/utils/capability-gate'
import { hasBridgeBankCorridor } from '@/components/AddWithdraw/bank-corridors'
import { PointsAction } from '@/services/services.types'
import { usePointsCalculation } from '@/hooks/usePointsCalculation'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { withdrawCountryUrl } from '@/utils/native-routes'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import { useTranslations } from 'next-intl'
import { resolveSettledTxHash } from '@/utils/settled-tx-hash.utils'
import { type Account } from '@/interfaces/interfaces'
import { parseAsString, useQueryState } from 'nuqs'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import { useWithdrawFlow } from './WithdrawFlowContext'
import { useWithdrawAmount, useWithdrawDestinationAmount } from './useWithdrawAmount'
import { bankAmountCurrency, normalizeBankAmount } from './bank-amount'
import { useBridgeOfframpQuote } from '@/hooks/useBridgeOfframpQuote'
import { bankStepGuards } from './step-guards'
import {
    BRIDGE_OFFRAMP_MIN_USD,
    bankPayoutMinimum,
    meetsBankPayoutMinimum,
    validateBankOfframpAmount,
} from './amount-validation'
import { formatBankAmount } from '@/utils/currency'
import { WITHDRAW_BANK_STEPS } from './types'
import {
    bankReferenceDestinationFields,
    bankReferenceProblem,
    bankReferenceSpecForRail,
    payoutDefaultReferenceNoteForRail,
    payoutNoteForRail,
} from './bank-reference'

/**
 * Flow hook for the Bridge bank-withdraw review page
 * (/withdraw/[country]/bank): the review → success stepper (named screen ids
 * in the URL), the offramp submission (create → send on-chain → confirm), the
 * capability gates and the KYC modal state. The amount arrives in the
 * URL (`?amount=`, TASK-21664/21665) — or, for an account paid in EUR, GBP,
 * MXN or COP, the bank amount the user typed (`?destinationAmount=`,
 * TASK-23054), whose USDC comes from a quote. The selected account lives in
 * the /withdraw-scoped flow context.
 */
export function useBridgeOfframpFlow() {
    const t = useTranslations('withdraw')
    const tErrors = useTranslations('errors')
    const toFriendlyError = useFriendlyError()
    // Copy shown when the on-chain deposit to the Bridge address succeeded but the
    // subsequent `/bridge/transfers/:id/confirm` call failed (most often a
    // fetchWithSentry timeout). The Bridge transfer row exists on the BE; the
    // poller / Bridge webhook will eventually complete it. We MUST NOT show a
    // Retry button in this state — retrying re-runs sendMoney() and would send
    // funds to the deposit address a second time (Sentry PEANUT-UI-QH9, 2026-06-01).
    const confirmPendingCopy = t('bank.confirmPending')

    const { selectedBankAccount: bankAccount, setSelectedBankAccount, error, setError } = useWithdrawFlow()
    // The provider refused the saved account for good; the review offers to add it again instead of Retry.
    const [isBankAccountNotUsable, setIsBankAccountNotUsable] = useState(false)
    const [urlAmount] = useWithdrawAmount()
    const [destinationAmountParam] = useWithdrawDestinationAmount()
    // the URL is editable: "90." or ".5" is read the way the quote API accepts
    // it, and anything else counts as no amount
    const destinationAmount = normalizeBankAmount(destinationAmountParam) ?? ''
    const { user, fetchUser } = useAuth()
    const { address, sendMoney, spendableBalance: balance } = useWallet()
    const { guardWithTos, showBridgeTos, hideTos } = useTosGuard()
    const queryClient = useQueryClient()
    const router = useRouter()
    // native/capacitor passes the country as ?country= instead of a path segment
    const [countryFromQuery] = useQueryState('country', parseAsString.withDefault(''))
    const [isLoading, setIsLoading] = useState(false)
    // Set as soon as the on-chain wallet→Bridge tx confirms. If a subsequent
    // confirmOfframp() call fails, this gates the UI into a "processing" state
    // instead of showing a Retry button that would re-fire sendMoney().
    const [submittedTxHash, setSubmittedTxHash] = useState<string | null>(null)
    // Execution proof for the success step: set only after confirmOfframp
    // succeeded. The ?step= param is user-editable — without this, a
    // hand-edited ?step=success rendered a success screen for a withdrawal
    // that never ran.
    const [completedTxHash, setCompletedTxHash] = useState<string | null>(null)
    // The USD amount the completed offramp actually moved. The success screen
    // renders THIS — `?amount=` stays user-editable after completion, and
    // rendering it would let a URL edit forge the confirmation (Chip round 8).
    const [executedAmountUsd, setExecutedAmountUsd] = useState<string | null>(null)
    const params = useParams()
    // read country from path params (web) or query params (native/capacitor)
    const country = (params.country as string) || countryFromQuery
    const [balanceErrorMessage, setBalanceErrorMessage] = useState<string | null>(null)
    // The optional reference the user sends with the payment. Form state only:
    // it has no place in a shared link.
    const [reference, setReference] = useState('')
    // null when the account's rail takes no reference — the field then stays hidden
    const referenceSpec = useMemo(
        () => (bankAccount ? bankReferenceSpecForRail(getOfframpConfigFromAccount(bankAccount).paymentRail) : null),
        [bankAccount]
    )
    const referenceProblem = referenceSpec ? bankReferenceProblem(reference, referenceSpec) : null
    const payoutNoteKey = useMemo(
        () => (bankAccount ? payoutNoteForRail(getOfframpConfigFromAccount(bankAccount).paymentRail) : null),
        [bankAccount]
    )
    const payoutDefaultReferenceNoteKey = useMemo(
        () =>
            bankAccount
                ? payoutDefaultReferenceNoteForRail(getOfframpConfigFromAccount(bankAccount).paymentRail)
                : null,
        [bankAccount]
    )
    const { hasPendingTransactions } = usePendingTransactions()

    const stepper = useFlowStepper({
        steps: WITHDRAW_BANK_STEPS,
        guards: bankStepGuards({ executed: !!completedTxHash }),
    })
    const step = stepper.step

    // Bank amount typed in EUR, GBP, MXN or COP (TASK-23054): the USDC that
    // leaves the balance is the quote's, at the provider's current rate, and
    // refreshes with the rate until the user confirms. That USDC is what the
    // offramp sends; the bank amount is an estimate.
    const accountCurrency = bankAmountCurrency(bankAccount)
    const bankCurrency = destinationAmount ? accountCurrency : null

    // Country-scoped bank-channel withdraw gate. Same rationale as the
    // add-money/[country]/bank page: scope to the rail jurisdiction this page
    // actually withdraws to (PT/DE/… → EU SEPA; US → ACH; etc.) so a stuck
    // PENDING rail in an unrelated jurisdiction can't block this page.
    const { gateFor } = useCapabilities()
    const bankCountry = useMemo(() => railJurisdictionForBank(getCountryFromPath(country)?.id), [country])
    const countryFromPath = getCountryFromPath(country)

    // The destination's payout minimum is in the account's currency (£3,
    // 50 MXN, 4,000 COP) — the amount step enforces it and the submit
    // re-checks it (Chip round 5: the flat $1 floor bypassed them). A bank
    // amount typed in that currency is compared as typed, so exactly 50 MXN
    // passes (TASK-23054). A USD ?amount= from an older link converts at the
    // quote rate first; until that rate loads the submit stays disabled rather
    // than under-enforcing.
    const payoutMinimum = bankPayoutMinimum(accountCurrency)
    const minNeedsRate = !bankCurrency && payoutMinimum > 1
    // One rate for the amount and the minimum: the quote. Without a typed bank
    // amount it is fetched for the rate alone, when the minimum needs one.
    const bankQuote = useBridgeOfframpQuote({
        currency: bankCurrency ?? (minNeedsRate ? accountCurrency : null),
        destinationAmount: bankCurrency ? destinationAmount : undefined,
        enabled: step === 'review' && !isLoading && !submittedTxHash,
    })
    const amountToWithdraw = bankCurrency ? (bankQuote.quote?.sourceAmount ?? '') : urlAmount
    // a quote whose refresh failed stays on screen but is not confirmed
    const isQuoteCurrent = !!bankQuote.quote && !bankQuote.isError
    const quoteRate = parseFloat(bankQuote.quote?.rate ?? '0')
    const isMinReady = !minNeedsRate || (isQuoteCurrent && quoteRate > 0)
    // What the bank receives, in its currency; undefined when only the $1 floor applies.
    const bankPayoutAmount = bankCurrency
        ? Number(destinationAmount)
        : minNeedsRate
          ? Number(urlAmount) * quoteRate
          : undefined
    const gate = useMemo(() => gateFor('withdraw', { channel: 'bank', country: bankCountry }), [gateFor, bankCountry])
    // bridge re-verification ("we're reviewing your details") modal for the
    // waiting-on-provider gate — keeps the status poll alive + auto-dismisses.
    const pendingModal = useWaitingOnProviderModal(gate)
    // EEA-uplift funnel events (PostHog): started on launch, completed on KYC
    // success. trackCompleted no-ops unless an uplift was started this session.
    const {
        trackStarted: trackUpliftStarted,
        trackCompleted: trackUpliftCompleted,
        reset: resetUpliftFunnel,
    } = useEeaUpliftFunnel('withdraw')

    const sumsubFlow = useMultiPhaseKycFlow({
        // Fire completed at Sumsub approval (verification submitted), not at
        // end-of-flow — so it isn't lost if the user drops during the
        // post-approval ToS / preparing steps.
        onKycApproved: () => trackUpliftCompleted(),
        // Abandoned attempt: clear the pending start so a later unrelated KYC
        // success on this page can't mis-fire eea_uplift_completed.
        onManualClose: resetUpliftFunnel,
    })
    // A ready bank rail can still carry a future-dated Bridge requirement (the
    // gate's `advisory`). The rail works until that date, so the withdrawal never
    // waits on it: inside the heads-up window the review screen shows a notice, and the verification
    // starts from the Home and Accounts task cards (PendingVerificationTasks).
    const advisoryDeadline = headsUpDeadline(gate.kind === 'ready' ? gate.advisory?.effectiveDate : undefined)
    const [showKycModal, setShowKycModal] = useState(false)

    // close kyc modal when sumsub sdk opens
    useEffect(() => {
        if (sumsubFlow.showWrapper) setShowKycModal(false)
    }, [sumsubFlow.showWrapper])

    // only bank reaches this page, so the bank-specific flag is the right one here
    const { isBankFromSend: fromSendFlow } = useSendFlowOrigin()

    // validate country is supported for bank withdrawals
    useEffect(() => {
        if (country) {
            const countryInfo = getCountryFromPath(country)
            if (!countryInfo || !hasBridgeBankCorridor(countryInfo.id)) {
                router.replace(`/withdraw${fromSendFlow ? '?method=bank' : ''}`)
            }
        }
    }, [country, router, fromSendFlow])

    const onBack = useSafeBack(fromSendFlow ? '/send' : '/withdraw')

    // Calculate points API call. Once the offramp executed, the estimate keys
    // off the EXECUTED amount — the URL stays editable after completion, and
    // keying off it let ?amount=5000 fetch a false $5,000 points preview onto
    // the success screen (Chip round 9).
    const pointsAmount = executedAmountUsd ?? amountToWithdraw
    const { pointsData } = usePointsCalculation(
        PointsAction.BRIDGE_TRANSFER,
        pointsAmount,
        !!(pointsAmount && bankAccount),
        bankAccount?.id
    )

    useEffect(() => {
        // Prerequisites live in the URL (amount) and the flow context (account).
        // A refresh on the success step loses the context — send the user back
        // to the flow entry rather than rendering a dead screen.
        // The recovery targets keep ?method=bank (land on a bare /withdraw and
        // the step the user is sent back to silently reverts to withdraw copy)
        // AND ?amount= (the URL is the sole durable amount store — dropping it
        // on the context-loss redirect forced a second amount entry, Chip
        // round 10).
        const recovery = new URLSearchParams()
        if (fromSendFlow) recovery.set('method', 'bank')
        if (urlAmount) recovery.set('amount', urlAmount)
        if (destinationAmount) recovery.set('destinationAmount', destinationAmount)
        const recoveryQs = recovery.toString()
        const recoveryQuery = recoveryQs ? `?${recoveryQs}` : ''
        if (step === 'success') {
            if (!bankAccount) router.replace(`/withdraw${recoveryQuery}`)
            return
        }
        // a bank amount is not the USDC yet — that arrives with its quote
        const hasAmount = bankCurrency ? !!destinationAmount : !!urlAmount || !!destinationAmount
        if (!hasAmount) {
            // If no amount, go back to main page
            router.replace(`/withdraw${recoveryQuery}`)
        } else if (!bankAccount) {
            // An amount with no destination — send the user to the country's
            // bank form, named in the URL, with the amount still on it
            recovery.set('step', 'form')
            router.replace(withdrawCountryUrl(country, `?${recovery.toString()}`))
        }
    }, [bankAccount, router, urlAmount, destinationAmount, bankCurrency, country, step, fromSendFlow])

    const destinationDetails = (account: Account) => {
        // Derive currency + rail from the account's actual type (GB→GBP, IBAN→EUR,
        // US→USD, CLABE→MXN) rather than re-deriving from a country switch whose
        // `default` returned an empty currency/rail. getOfframpConfigFromAccount
        // tolerates both the projected ('gb') and Prisma-shaped ('BANK_GB')
        // strings and keeps this flow consistent with the Claim flow
        // (BankFlowManager). Manteca accounts never reach this Bridge page
        // (separate /withdraw/manteca route), so its throw cannot fire here.
        const { currency, paymentRail } = getOfframpConfigFromAccount(account)
        return {
            currency,
            paymentRail,
            externalAccountId: account.bridgeAccountId,
        }
    }

    const proceedWithOfframp = async () => {
        if (gate.kind !== 'ready') {
            // capabilities still loading — silently no-op.
            if (gate.kind === 'loading') return
            // `waiting-on-provider` means bridge is re-reviewing submitted info
            // (e.g. right after an eea uplift) — show the pending modal instead of
            // a dead button, and re-arm the capability poller so we pick up
            // bridge's latest status live and the modal auto-dismisses on clear.
            if (!isVerifiableGate(gate.kind) && gate.kind !== 'accept-tos') {
                pendingModal.open()
                return
            }
            if (gate.kind === 'accept-tos') {
                guardWithTos()
            } else {
                // urgent (post-cliff) eea uplift lands here as a fixable-rejection —
                // fire the funnel event as this KYC modal opens.
                const upliftTrigger = upliftTriggerFromGate(gate)
                if (upliftTrigger) trackUpliftStarted(upliftTrigger)
                setShowKycModal(true)
            }
            return
        }

        // A USD ?amount= meets a GBP/MXN/COP minimum through the quote rate —
        // the submit is disabled until it loads; reaching here early is a race,
        // not a user error: no-op rather than under-enforce.
        if (!isMinReady) return
        // The ToS step calls this directly, past the disabled button: a quote
        // whose refresh failed is never confirmed.
        if (bankCurrency && !isQuoteCurrent) return

        // the submit is disabled while the reference breaks the rail's limits
        if (referenceProblem) return

        // The amount is a user-editable URL param — revalidate synchronously
        // before anything fires (Chip review, PR #2917): finite, positive, at
        // or above the $1 floor, within the displayed balance, and then at or
        // above the destination's payout minimum in its own currency (round 5 —
        // was a flat $1). The normalized string goes on the wire.
        const amountCheck = validateBankOfframpAmount(amountToWithdraw, balance)
        if (!amountCheck.ok) {
            // the submit button is disabled until the balance loads — reaching
            // here with balanceLoading is a race, not a user error: no-op.
            if (amountCheck.reason === 'balanceLoading') return
            const errorMessage =
                amountCheck.reason === 'insufficientBalance'
                    ? tErrors('notEnoughBalanceAddFunds')
                    : amountCheck.reason === 'belowMinimum'
                      ? t('errors.minimumWithdrawal', { amount: formatBankAmount(BRIDGE_OFFRAMP_MIN_USD, 'USD') })
                      : t('errors.invalidAmount')
            setError({ showError: true, errorMessage })
            return
        }
        if (
            accountCurrency &&
            bankPayoutAmount !== undefined &&
            !meetsBankPayoutMinimum(bankPayoutAmount, accountCurrency)
        ) {
            setError({
                showError: true,
                errorMessage: t('errors.minimumWithdrawal', {
                    amount: formatBankAmount(payoutMinimum, accountCurrency),
                }),
            })
            return
        }
        const amountUsd = amountCheck.normalized

        setIsLoading(true)
        setError({ showError: false, errorMessage: '' })

        if (!bankAccount || !user?.user.bridgeCustomerId || !address) {
            setError({ showError: true, errorMessage: t('errors.userDetailsMissing') })
            setIsLoading(false)
            return
        }

        if (!bankAccount.bridgeAccountId) {
            setError({ showError: true, errorMessage: t('errors.bankAccountMissing') })
            setIsLoading(false)
            return
        }

        posthog.capture(ANALYTICS_EVENTS.WITHDRAW_CONFIRMED, {
            amount_usd: amountUsd,
            method_type: 'bridge',
            country,
        })

        // Set alongside every pre-throw setError below: those messages are already
        // the right copy (backend-authored, or the confirm-pending notice), and the
        // catch must not overwrite them with the generic mapper output.
        let errorAlreadyDisplayed = false

        try {
            // Step 1: create the transfer to get deposit instructions
            const destination = destinationDetails(bankAccount)
            if (!destination.externalAccountId) {
                throw new Error('External account ID is missing.')
            }

            const createPayload = {
                // note: for bank withdrawals, minimum $1 is required
                // reference: https://apidocs.bridge.xyz/docs/transaction-costs
                amount: amountUsd,
                developer_fee: '0',
                onBehalfOf: user.user.bridgeCustomerId,
                source: {
                    currency: PEANUT_WALLET_TOKEN_SYMBOL.toLowerCase(),
                    paymentRail: getBridgeChainName(PEANUT_WALLET_CHAIN.id.toString()) ?? 'arbitrum', // source blockchain, bridge expects this to be arbitrum not arbitrum one
                    fromAddress: address,
                },
                destination: {
                    ...destination,
                    externalAccountId: destination.externalAccountId,
                    ...bankReferenceDestinationFields(destination.paymentRail, reference),
                },
            }
            const { data, error, code, status } = await createOfframp(createPayload)

            if (error) {
                const notUsable = code === API_ERROR_CODES.BANK_ACCOUNT_NOT_USABLE
                if (notUsable) {
                    setIsBankAccountNotUsable(true)
                    // the API switched the account off: refetch so the saved list drops it
                    void fetchUser()
                }
                setError({
                    showError: true,
                    errorMessage: notUsable
                        ? toFriendlyError(new ApiError(error, { status: status ?? 409, code }))
                        : error,
                })
                errorAlreadyDisplayed = true
                throw new Error(error)
            }

            if (!data?.depositInstructions?.toAddress || !data.transferId) {
                setError({ showError: true, errorMessage: t('errors.depositAddressFailed') })
                errorAlreadyDisplayed = true
                throw new Error('Failed to get deposit address from the backend.')
            }

            // Step 2: prepare and send the transaction from peanut wallet to the deposit address
            const { receipt, userOpHash, txHash } = await sendMoney(
                data.depositInstructions.toAddress as `0x${string}`,
                createPayload.amount,
                // Card-balance funding links to this offramp, so Activity shows one withdrawal
                { kind: 'FIAT_OFFRAMP', fundsIntentId: data.intentId }
            )

            if (receipt !== null && isTxReverted(receipt)) {
                throw new Error('Transaction reverted by the network.')
            }

            // Step 3: Confirm the transfer with the backend to make it visible in history.
            // Prefer the on-chain tx hash; fall back to the collateral withdraw tx hash
            // (collateral-only path) BEFORE the userOp hash. confirmOfframp expects a real
            // 32-byte tx hash — userOpHash is an account-abstraction bundler hash, not a
            // chain tx hash, and the BE rejects it.
            const txIdentifier = resolveSettledTxHash({ receipt, txHash, userOpHash }, 'withdraw-bank').hash
            if (!txIdentifier) throw new Error('No transaction identifier returned from sendMoney')

            // Mark the on-chain leg done BEFORE confirmOfframp. From this point on
            // any error path (including a confirm timeout) must NOT offer Retry —
            // re-running this handler would call sendMoney() again and double-pay.
            setSubmittedTxHash(txIdentifier)

            const confirmResult = await confirmOfframp(data.transferId, txIdentifier)

            if (confirmResult.error) {
                // On-chain tx succeeded, backend confirm failed. Bridge will still
                // process the deposit (the funds are at the deposit address and the
                // BE has the transfer row). Show a processing state, NOT an error
                // with a Retry button — see confirmPendingCopy + the gate below.
                setError({
                    showError: true,
                    errorMessage: confirmPendingCopy,
                })
                errorAlreadyDisplayed = true
                throw new Error(confirmResult.error)
            }

            // Invalidate the transactions query so the Activity widget shows
            // the pending OFFRAMP entry immediately, instead of waiting up to
            // 30s tanstack staleTime + Bridge polling cadence.
            queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })

            // proof first, then the step — the success guard reads it. The
            // executed amount pins alongside it: the success screen must show
            // what moved, not what the URL says now.
            setCompletedTxHash(txIdentifier)
            setExecutedAmountUsd(amountUsd)
            void stepper.goTo('success')
            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_COMPLETED, {
                amount_usd: amountUsd,
                method_type: 'bridge',
                country,
            })
        } catch (e) {
            // Card re-approval dismissed, or the screen left, before the
            // on-chain leg was prepared or signed. The offramp transfer row
            // exists but no funds moved, so this is control flow, not a failed
            // withdrawal: the user can run it again from the same screen.
            if (e instanceof SpendRecoveryAbortedError) return

            const error = toFriendlyError(e)
            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_FAILED, {
                method_type: 'bridge',
                error_message: error,
            })
            if (!errorAlreadyDisplayed) {
                setError({ showError: true, errorMessage: error })
            }
        } finally {
            setIsLoading(false)
        }
    }

    // A fresh closure every render, on purpose (Chip review round 4): a
    // useCallback here froze the FIRST render's proceedWithOfframp — its
    // captured `gate`/`balance` never updated (the deps are all stable for
    // the page's lifetime), so a click after capabilities resolved ran the
    // stale `gate.kind === 'loading'` no-op forever. Nothing needs a stable
    // identity: this is a button onClick, not an effect dep.
    const handleCreateAndInitiateOfframp = () => void proceedWithOfframp()

    useEffect(() => {
        fetchUser()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Balance validation
    useEffect(() => {
        // Skip balance check if transaction is pending
        // isLoading covers the gap between sendMoney completing and confirmOfframp completing
        if (hasPendingTransactions || isLoading) {
            return
        }

        if (!amountToWithdraw || amountToWithdraw === '0' || isNaN(Number(amountToWithdraw)) || balance === undefined) {
            setBalanceErrorMessage(null)
            return
        }

        // gate on the displayed total; an in-transit shortfall passes here and
        // fails late with the settling message at execution.
        setBalanceErrorMessage(
            isAmountWithinBalance(amountToWithdraw, balance) ? null : tErrors('notEnoughBalanceAddFunds')
        )
    }, [amountToWithdraw, balance, hasPendingTransactions, isLoading, tErrors])

    return {
        step,
        stepper,
        // submit stays disabled until the spendable balance has loaded — an
        // unloaded balance must not be treated as headroom (Chip round 3) —
        // and, for GB/MX, until the FX rate behind the rail minimum has
        // loaded (Chip round 5)
        isSubmitReady: balance !== undefined && isMinReady && (!bankCurrency || isQuoteCurrent),
        // the amount the completed offramp moved — success screens render this,
        // never the still-editable ?amount= (Chip round 8)
        executedAmountUsd,
        amountToWithdraw,
        // bank amount typed in its currency (TASK-23054): null on the USD path
        bankAmount: bankCurrency
            ? {
                  currency: bankCurrency,
                  destinationAmount,
                  quote: bankQuote.quote,
                  quoteFailed: bankQuote.isError,
                  refetchQuote: bankQuote.refetch,
              }
            : null,
        bankAccount,
        country,
        countryFromPath,
        fromSendFlow,
        user,
        error,
        isLoading,
        submittedTxHash,
        balanceErrorMessage,
        confirmPendingCopy,
        reference,
        setReference,
        referenceSpec,
        payoutNoteKey,
        payoutDefaultReferenceNoteKey,
        referenceProblem,
        pointsData,
        onBack,
        handleCreateAndInitiateOfframp,
        // Clearing the account sends the review back to this country's bank
        // form with the amount kept (see the redirect effect above).
        onAddBankAccountAgain: isBankAccountNotUsable
            ? () => {
                  setIsBankAccountNotUsable(false)
                  setError({ showError: false, errorMessage: '' })
                  setSelectedBankAccount(null)
              }
            : undefined,
        // gate + modal surface
        gate,
        sumsubFlow,
        showKycModal,
        setShowKycModal,
        resetUpliftFunnel,
        showBridgeTos,
        hideTos,
        advisoryDeadline,
        pendingModal,
    }
}

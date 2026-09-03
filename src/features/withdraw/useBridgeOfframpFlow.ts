'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'
import { useWallet } from '@/hooks/wallet/useWallet'
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
import { useAuth } from '@/context/authContext'
import { useTosGuard } from '@/hooks/useTosGuard'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useWaitingOnProviderModal } from '@/hooks/useWaitingOnProviderModal'
import { useAdvisoryPreempt } from '@/hooks/useAdvisoryPreempt'
import { useEeaUpliftFunnel } from '@/hooks/useEeaUpliftFunnel'
import { upliftTriggerFromGate, upliftTriggerFromAdvisory } from '@/utils/eea-uplift.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { isVerifiableGate } from '@/utils/capability-gate'
import { isBridgeSupportedCountry } from '@/utils/regions.utils'
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
import { useWithdrawAmount } from './useWithdrawAmount'
import { bankStepGuards } from './step-guards'
import { validateBankOfframpAmount } from './amount-validation'
import { WITHDRAW_BANK_STEPS } from './types'

/**
 * Flow hook for the Bridge bank-withdraw review page
 * (/withdraw/[country]/bank): the review → success stepper (named screen ids
 * in the URL), the offramp submission (create → send on-chain → confirm), the
 * capability gates and the KYC/advisory modal state. The amount arrives in the
 * URL (`?amount=`, TASK-21664/21665); the selected account lives in the
 * /withdraw-scoped flow context.
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

    const { selectedBankAccount: bankAccount, error, setError } = useWithdrawFlow()
    const [amountToWithdraw] = useWithdrawAmount()
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
    const params = useParams()
    // read country from path params (web) or query params (native/capacitor)
    const country = (params.country as string) || countryFromQuery
    const [balanceErrorMessage, setBalanceErrorMessage] = useState<string | null>(null)
    const { hasPendingTransactions } = usePendingTransactions()

    const stepper = useFlowStepper({
        steps: WITHDRAW_BANK_STEPS,
        guards: bankStepGuards({ executed: !!completedTxHash }),
    })
    const step = stepper.step

    // Country-scoped bank-channel withdraw gate. Same rationale as the
    // add-money/[country]/bank page: scope to the rail jurisdiction this page
    // actually withdraws to (PT/DE/… → EU SEPA; US → ACH; etc.) so a stuck
    // PENDING rail in an unrelated jurisdiction can't block this page.
    const { gateFor } = useCapabilities()
    const bankCountry = useMemo(() => railJurisdictionForBank(getCountryFromPath(country)?.id), [country])
    const countryFromPath = getCountryFromPath(country)
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
    // A ready bank rail can still carry a pending Bridge requirement (the gate's
    // `advisory`). Enforce it as a mandatory, non-skippable pre-empt before the
    // withdrawal — the offramp cannot proceed until it's completed.
    const advisory = gate.kind === 'ready' ? gate.advisory : undefined
    const { intercept: advisoryIntercept, modalProps: advisoryModalProps } = useAdvisoryPreempt({
        advisory,
        isLoading: sumsubFlow.isLoading,
        // Route through the self-heal resubmit path (reheal-tagged action) so the
        // completed submission round-trips to Bridge. start-action mints a plain
        // token whose webhook completion has no Bridge relay → answers are dropped.
        onCompleteNow: () => {
            if (!advisory) return Promise.resolve()
            return sumsubFlow.handleSelfHealResubmit('BRIDGE', advisory.requirementKey)
        },
    })
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
            if (!countryInfo || !isBridgeSupportedCountry(countryInfo.id)) {
                router.replace(`/withdraw${fromSendFlow ? '?method=bank' : ''}`)
            }
        }
    }, [country, router, fromSendFlow])

    const onBack = useSafeBack(fromSendFlow ? '/send' : '/withdraw')

    // Calculate points API call
    const { pointsData } = usePointsCalculation(
        PointsAction.BRIDGE_TRANSFER,
        amountToWithdraw,
        !!(amountToWithdraw && bankAccount),
        bankAccount?.id
    )

    useEffect(() => {
        // Prerequisites live in the URL (amount) and the flow context (account).
        // A refresh on the success step loses the context — send the user back
        // to the flow entry rather than rendering a dead screen.
        // Both targets keep ?method=bank: land on a bare /withdraw and the step
        // the user is sent back to silently reverts to withdraw copy.
        const sendMarker = fromSendFlow ? '?method=bank' : ''
        if (step === 'success') {
            if (!bankAccount) router.replace(`/withdraw${sendMarker}`)
            return
        }
        if (!amountToWithdraw) {
            // If no amount, go back to main page
            router.replace(`/withdraw${sendMarker}`)
        } else if (!bankAccount && amountToWithdraw) {
            // If amount is set but no bank account, go to country method selection
            router.replace(withdrawCountryUrl(country, sendMarker))
        }
    }, [bankAccount, router, amountToWithdraw, country, step, fromSendFlow])

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

        // The amount is a user-editable URL param — revalidate synchronously
        // before anything fires (Chip review, PR #2917): finite, positive, at
        // or above the Bridge $1 floor, within the displayed balance. The
        // normalized string is what goes on the wire.
        const amountCheck = validateBankOfframpAmount(amountToWithdraw, balance)
        if (!amountCheck.ok) {
            // the submit button is disabled until the balance loads — reaching
            // here with balanceLoading is a race, not a user error: no-op.
            if (amountCheck.reason === 'balanceLoading') return
            const errorMessage =
                amountCheck.reason === 'insufficientBalance'
                    ? tErrors('notEnoughBalanceAddFunds')
                    : amountCheck.reason === 'belowMinimum'
                      ? t('errors.minimumWithdrawal', { amount: '$1' })
                      : t('errors.invalidAmount')
            setError({ showError: true, errorMessage })
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
                },
            }
            const { data, error } = await createOfframp(createPayload)

            if (error) {
                setError({ showError: true, errorMessage: error })
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
                { kind: 'FIAT_OFFRAMP' }
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

            // proof first, then the step — the success guard reads it
            setCompletedTxHash(txIdentifier)
            void stepper.goTo('success')
            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_COMPLETED, {
                amount_usd: amountUsd,
                method_type: 'bridge',
                country,
            })
        } catch (e) {
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

    // Enforce the mandatory verification pre-empt, then run the offramp. When the
    // gate isn't `ready` (or there's no pending requirement) this is a no-op and
    // proceedWithOfframp runs straight away (it handles the not-ready cases).
    // upcoming (future-dated) eea uplift opens the advisory modal here — fire the
    // funnel event as it opens.
    // A fresh closure every render, on purpose (Chip review round 4): a
    // useCallback here froze the FIRST render's proceedWithOfframp — its
    // captured `gate`/`balance` never updated (the deps are all stable for
    // the page's lifetime), so a click after capabilities resolved ran the
    // stale `gate.kind === 'loading'` no-op forever. Nothing needs a stable
    // identity: this is a button onClick, not an effect dep.
    const handleCreateAndInitiateOfframp = () => {
        const advisoryTrigger = upliftTriggerFromAdvisory(advisory)
        if (advisoryTrigger) trackUpliftStarted(advisoryTrigger)
        advisoryIntercept(() => void proceedWithOfframp())
    }

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
        // unloaded balance must not be treated as headroom (Chip round 3)
        isBalanceReady: balance !== undefined,
        amountToWithdraw,
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
        pointsData,
        onBack,
        handleCreateAndInitiateOfframp,
        // gate + modal surface
        gate,
        sumsubFlow,
        showKycModal,
        setShowKycModal,
        resetUpliftFunnel,
        showBridgeTos,
        hideTos,
        advisoryModalProps,
        pendingModal,
    }
}

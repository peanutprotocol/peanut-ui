'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { ALL_COUNTRIES_ALPHA3_TO_ALPHA2 } from '@/components/AddMoney/consts'
import Card from '@/components/Global/Card'
import ErrorAlert from '@/components/Global/ErrorAlert'
import InfoCard from '@/components/Global/InfoCard'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { AccountType, type Account } from '@/interfaces'
import { formatIban, shortenStringLong, isTxReverted } from '@/utils/general.utils'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TRANSACTIONS } from '@/constants/query.consts'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { ErrorHandler } from '@/utils/friendly-error.utils'
import { INSUFFICIENT_BALANCE_MESSAGE, isAmountWithinBalance } from '@/utils/balance.utils'
import { getBridgeChainName } from '@/utils/bridge-accounts.utils'
import { getOfframpConfigFromAccount, getCountryFromPath, railJurisdictionForBank } from '@/utils/bridge.utils'
import { createOfframp, confirmOfframp } from '@/app/actions/offramp'
import { useAuth } from '@/context/authContext'
import { useTosGuard } from '@/hooks/useTosGuard'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { KycReverificationPendingModal } from '@/components/Kyc/KycReverificationPendingModal'
import { useWaitingOnProviderModal } from '@/hooks/useWaitingOnProviderModal'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import AdvisoryPreemptModal from '@/components/Kyc/AdvisoryPreemptModal'
import { useAdvisoryPreempt } from '@/hooks/useAdvisoryPreempt'
import { useEeaUpliftFunnel } from '@/hooks/useEeaUpliftFunnel'
import { upliftTriggerFromGate, upliftTriggerFromAdvisory } from '@/utils/eea-uplift.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { resolveKycModalVariant, getGateUserMessage } from '@/utils/capability-gate'
import { useModalsContext } from '@/context/ModalsContext'
import ExchangeRate from '@/components/ExchangeRate'
import countryCurrencyMappings, { isNonEuroSepaCountry } from '@/constants/countryCurrencyMapping'
import { isBridgeSupportedCountry, getRegionIntent } from '@/utils/regions.utils'
import { PointsAction } from '@/services/services.types'
import { usePointsCalculation } from '@/hooks/usePointsCalculation'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { withdrawCountryUrl } from '@/utils/native-routes'
import { useSafeBack } from '@/hooks/useSafeBack'

type View = 'INITIAL' | 'SUCCESS'

// Copy shown when the on-chain deposit to the Bridge address succeeded but the
// subsequent `/bridge/transfers/:id/confirm` call failed (most often a
// fetchWithSentry timeout). The Bridge transfer row exists on the BE; the
// poller / Bridge webhook will eventually complete it. We MUST NOT show a
// Retry button in this state — retrying re-runs sendMoney() and would send
// funds to the deposit address a second time (Sentry PEANUT-UI-QH9, 2026-06-01).
const CONFIRM_PENDING_COPY =
    'Your transfer is processing. Funds were sent on-chain successfully — this can take a few minutes to confirm. If you don’t see the withdrawal in your activity within 30 minutes, please contact support.'

export default function WithdrawBankPage() {
    const {
        amountToWithdraw,
        selectedBankAccount: bankAccount,
        error,
        setError,
        setAmountToWithdraw,
        setSelectedMethod,
    } = useWithdrawFlow()
    const { user, fetchUser } = useAuth()
    const { address, sendMoney, spendableBalance: balance } = useWallet()
    const { guardWithTos, showBridgeTos, hideTos } = useTosGuard()
    const queryClient = useQueryClient()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isLoading, setIsLoading] = useState(false)
    const [view, setView] = useState<View>('INITIAL')
    // Set as soon as the on-chain wallet→Bridge tx confirms. If a subsequent
    // confirmOfframp() call fails, this gates the UI into a "processing" state
    // instead of showing a Retry button that would re-fire sendMoney().
    const [submittedTxHash, setSubmittedTxHash] = useState<string | null>(null)
    const params = useParams()
    // read country from path params (web) or query params (native/capacitor)
    const country = (params.country as string) || searchParams.get('country') || ''
    const [balanceErrorMessage, setBalanceErrorMessage] = useState<string | null>(null)
    const { hasPendingTransactions } = usePendingTransactions()
    // Country-scoped bank-channel withdraw gate. Same rationale as the
    // add-money/[country]/bank page: scope to the rail jurisdiction this page
    // actually withdraws to (PT/DE/… → EU SEPA; US → ACH; etc.) so a stuck
    // PENDING rail in an unrelated jurisdiction can't block this page.
    const { gateFor } = useCapabilities()
    const bankCountry = useMemo(() => railJurisdictionForBank(getCountryFromPath(country)?.id), [country])
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
        // note: eea_uplift_started is fired at modal-open (the handlers below),
        // not here, so abandoners are captured too.
        onCompleteNow: () => {
            if (!advisory) return Promise.resolve()
            return sumsubFlow.handleSelfHealResubmit('BRIDGE', advisory.requirementKey)
        },
    })
    const [showKycModal, setShowKycModal] = useState(false)
    const { setIsSupportModalOpen } = useModalsContext()

    // close kyc modal when sumsub sdk opens
    useEffect(() => {
        if (sumsubFlow.showWrapper) setShowKycModal(false)
    }, [sumsubFlow.showWrapper])

    // validate country is supported for bank withdrawals
    useEffect(() => {
        if (country) {
            const countryInfo = getCountryFromPath(country)
            if (!countryInfo || !isBridgeSupportedCountry(countryInfo.id)) {
                router.replace('/withdraw')
            }
        }
    }, [country, isBridgeSupportedCountry, router])

    // check if we came from send flow - using method param to detect (only bank goes through this page)
    const methodParam = searchParams.get('method')
    const fromSendFlow = methodParam === 'bank'
    const onBack = useSafeBack(fromSendFlow ? '/send' : '/withdraw')

    const nonEuroCurrency = countryCurrencyMappings.find(
        (currency) =>
            country.toLowerCase() === currency.country.toLowerCase() ||
            currency.path?.toLowerCase() === country.toLowerCase()
    )?.currencyCode

    // non-eur sepa countries that are currently experiencing issues
    const isNonEuroSepa = isNonEuroSepaCountry(nonEuroCurrency)

    // Calculate points API call
    const { pointsData } = usePointsCalculation(
        PointsAction.BRIDGE_TRANSFER,
        amountToWithdraw,
        !!(amountToWithdraw && bankAccount),
        bankAccount?.id
    )

    useEffect(() => {
        // Skip redirects when on success view — clearing state during navigation
        // would race with router.push('/home') and redirect back to /withdraw
        if (view === 'SUCCESS') return
        if (!amountToWithdraw) {
            // If no amount, go back to main page
            router.replace('/withdraw')
        } else if (!bankAccount && amountToWithdraw) {
            // If amount is set but no bank account, go to country method selection
            router.replace(withdrawCountryUrl(country))
        }
    }, [bankAccount, router, amountToWithdraw, country, view])

    const destinationDetails = (account: Account) => {
        // Derive currency + rail from the account's actual type (GB→GBP, IBAN→EUR,
        // US→USD, CLABE→MXN) rather than re-deriving from a country switch whose
        // `default` returned an empty currency/rail. A UK account that arrived typed
        // anything but GB (the pre-BANK_GB BE mistype, or a Prisma-shaped 'BANK_GB'
        // string) fell through that default → empty payload → "External account ID
        // is missing.". getOfframpConfigFromAccount tolerates both the projected
        // ('gb') and Prisma-shaped ('BANK_GB') strings and keeps this flow
        // consistent with the Claim flow (BankFlowManager). Manteca accounts never
        // reach this Bridge page (separate /withdraw/manteca route), so its throw
        // cannot fire here.
        const { currency, paymentRail } = getOfframpConfigFromAccount(account)
        return {
            currency,
            paymentRail,
            externalAccountId: account.bridgeAccountId,
        }
    }

    const getBicAndRoutingNumber = () => {
        if (bankAccount && bankAccount.type === AccountType.IBAN) {
            return bankAccount.bic?.toUpperCase() ?? 'N/A'
        } else if (bankAccount && bankAccount.type === AccountType.US) {
            return bankAccount.routingNumber?.toUpperCase() ?? 'N/A'
        } else if (bankAccount && bankAccount.type === AccountType.CLABE) {
            return bankAccount.identifier?.toUpperCase() ?? 'N/A'
        } else if (bankAccount && bankAccount.type === AccountType.GB) {
            return bankAccount.sortCode ?? 'N/A'
        }

        return 'N/A'
    }

    const proceedWithOfframp = async () => {
        if (gate.kind !== 'ready') {
            // capabilities still loading — silently no-op.
            if (gate.kind === 'loading') return
            // `waiting-on-provider` means bridge is re-reviewing submitted info
            // (e.g. right after an eea uplift) — show the pending modal instead of
            // a dead button, and re-arm the capability poller so we pick up
            // bridge's latest status live and the modal auto-dismisses on clear.
            if (gate.kind === 'waiting-on-provider') {
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

        setIsLoading(true)
        setError({ showError: false, errorMessage: '' })

        if (!bankAccount || !user?.user.bridgeCustomerId || !address) {
            setError({ showError: true, errorMessage: 'User details, bridge account, or wallet address not found.' })
            setIsLoading(false)
            return
        }

        if (!bankAccount.bridgeAccountId) {
            setError({ showError: true, errorMessage: 'Bank account is missing.' })
            setIsLoading(false)
            return
        }

        posthog.capture(ANALYTICS_EVENTS.WITHDRAW_CONFIRMED, {
            amount_usd: amountToWithdraw,
            method_type: 'bridge',
            country,
        })

        try {
            // Step 1: create the transfer to get deposit instructions
            const destination = destinationDetails(bankAccount)
            if (!destination.externalAccountId) {
                throw new Error('External account ID is missing.')
            }

            const createPayload = {
                // note: for bank withdrawals, minimum $1 is required
                // reference: https://apidocs.bridge.xyz/docs/transaction-costs
                amount: amountToWithdraw,
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
                throw new Error(error)
            }

            if (!data?.depositInstructions?.toAddress || !data.transferId) {
                setError({ showError: true, errorMessage: 'Failed to get deposit address from the backend.' })
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
            const txIdentifier = receipt?.transactionHash ?? txHash ?? userOpHash
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
                // with a Retry button — see CONFIRM_PENDING_COPY + the gate below.
                setError({
                    showError: true,
                    errorMessage: CONFIRM_PENDING_COPY,
                })
                throw new Error(confirmResult.error)
            }

            // Invalidate the transactions query so the Activity widget shows
            // the pending OFFRAMP entry immediately, instead of waiting up to
            // 30s tanstack staleTime + Bridge polling cadence.
            queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })

            setView('SUCCESS')
            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_COMPLETED, {
                amount_usd: amountToWithdraw,
                method_type: 'bridge',
                country,
            })
        } catch (e: any) {
            const error = ErrorHandler(e)
            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_FAILED, {
                method_type: 'bridge',
                error_message: error,
            })
            if (error.includes('Something failed. Please try again.')) {
                setError({ showError: true, errorMessage: e.message })
            } else {
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
    const handleCreateAndInitiateOfframp = () => {
        const advisoryTrigger = upliftTriggerFromAdvisory(advisory)
        if (advisoryTrigger) trackUpliftStarted(advisoryTrigger)
        advisoryIntercept(() => void proceedWithOfframp())
    }

    const countryCodeForFlag = () => {
        if (!bankAccount?.details?.countryCode) return ''
        const code =
            ALL_COUNTRIES_ALPHA3_TO_ALPHA2[bankAccount.details.countryCode ?? ''] ?? bankAccount.details.countryCode
        return code.toLowerCase()
    }

    useEffect(() => {
        fetchUser()
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
        setBalanceErrorMessage(isAmountWithinBalance(amountToWithdraw, balance) ? null : INSUFFICIENT_BALANCE_MESSAGE)
    }, [amountToWithdraw, balance, hasPendingTransactions, isLoading])

    if (!bankAccount) {
        return null
    }

    return (
        <div className="flex min-h-[inherit] w-full flex-col justify-start gap-8 self-start">
            <NavHeader
                title={fromSendFlow ? 'Send' : 'Withdraw'}
                icon={view === 'SUCCESS' ? 'cancel' : undefined}
                onPrev={() => {
                    if (view === 'SUCCESS') {
                        // Navigate first, then reset — otherwise clearing amountToWithdraw
                        // triggers the useEffect redirect to /withdraw, overriding /home
                        router.push('/home')
                        setAmountToWithdraw('')
                        setSelectedMethod(null)
                    } else {
                        onBack()
                    }
                }}
            />

            {view === 'INITIAL' && (
                <div className="my-auto flex h-full w-full flex-col justify-center space-y-4 pb-5">
                    <PeanutActionDetailsCard
                        countryCodeForFlag={countryCodeForFlag()}
                        avatarSize="small"
                        transactionType={'WITHDRAW_BANK_ACCOUNT'}
                        recipientType={'BANK_ACCOUNT'}
                        recipientName={bankAccount?.identifier ?? 'Bank Account'}
                        amount={amountToWithdraw}
                        tokenSymbol={PEANUT_WALLET_TOKEN_SYMBOL}
                    />

                    {/* Warning for non-EUR SEPA countries (not UK — UK uses Faster Payments with GBP) */}
                    {isNonEuroSepa && bankAccount?.type !== AccountType.GB && (
                        <InfoCard
                            variant="info"
                            icon="info"
                            title="We send EUR to your bank"
                            description={
                                'Withdrawals are sent in EUR. Your bank may charge conversion fees or reject the transaction if EUR deposits are not supported.'
                            }
                        />
                    )}

                    <Card className="rounded-sm">
                        <PaymentInfoRow
                            label={'Account Owner'}
                            value={bankAccount?.details?.accountOwnerName || user?.user.fullName || 'N/A'}
                        />
                        {bankAccount?.type === AccountType.IBAN ? (
                            <>
                                <PaymentInfoRow
                                    label={'IBAN'}
                                    value={
                                        bankAccount?.identifier
                                            ? formatIban(bankAccount.identifier)
                                            : '' /* fallback to empty string to avoid runtime error */
                                    }
                                />
                                <PaymentInfoRow label="BIC" value={getBicAndRoutingNumber()} />
                            </>
                        ) : bankAccount?.type === AccountType.CLABE ? (
                            <>
                                <PaymentInfoRow label={'CLABE'} value={bankAccount?.identifier.toUpperCase()} />
                            </>
                        ) : bankAccount?.type === AccountType.GB ? (
                            <>
                                <PaymentInfoRow label={'Account Number'} value={bankAccount?.identifier} />
                                <PaymentInfoRow label={'Sort Code'} value={getBicAndRoutingNumber()} />
                            </>
                        ) : (
                            <>
                                <PaymentInfoRow label={'Account Number'} value={bankAccount?.identifier} />
                                <PaymentInfoRow label={'Routing Number'} value={getBicAndRoutingNumber()} />
                            </>
                        )}
                        <ExchangeRate
                            accountType={bankAccount.type}
                            nonEuroCurrency={nonEuroCurrency}
                            amountToConvert={amountToWithdraw}
                        />
                        <PaymentInfoRow hideBottomBorder label="Fee" value={`$ 0.00`} />
                    </Card>

                    {submittedTxHash ? (
                        // On-chain leg already fired. Even if confirmOfframp failed
                        // we must NOT offer Retry — it would re-run sendMoney() and
                        // double-pay (Sentry PEANUT-UI-QH9). Surface the in-progress
                        // state and a Done button that takes the user home.
                        <Button
                            shadowSize="4"
                            className="w-full"
                            onClick={() => {
                                router.push('/home')
                                setAmountToWithdraw('')
                                setSelectedMethod(null)
                            }}
                        >
                            Done
                        </Button>
                    ) : error.showError ? (
                        <Button
                            disabled={isLoading}
                            onClick={handleCreateAndInitiateOfframp}
                            loading={isLoading}
                            shadowSize="4"
                            className="w-full"
                            icon="retry"
                            iconSize={14}
                        >
                            Retry
                        </Button>
                    ) : (
                        <Button
                            icon="arrow-up"
                            loading={isLoading}
                            iconSize={12}
                            shadowSize="4"
                            onClick={handleCreateAndInitiateOfframp}
                            disabled={isLoading || !bankAccount || !!balanceErrorMessage}
                            className="w-full"
                        >
                            Withdraw
                        </Button>
                    )}
                    {submittedTxHash ? (
                        <InfoCard
                            variant="info"
                            icon="info"
                            title="Transfer processing"
                            description={CONFIRM_PENDING_COPY}
                        />
                    ) : (
                        error.showError && <ErrorAlert description={error.errorMessage} />
                    )}
                    {balanceErrorMessage && <ErrorAlert description={balanceErrorMessage} />}
                </div>
            )}

            {view === 'SUCCESS' && (
                <PaymentSuccessView
                    isWithdrawFlow
                    currencyAmount={`$${amountToWithdraw}`}
                    message={bankAccount ? shortenStringLong(bankAccount.identifier.toUpperCase()) : ''}
                    points={pointsData?.estimatedPoints}
                    onComplete={() => {
                        setAmountToWithdraw('')
                        setSelectedMethod(null)
                    }}
                />
            )}

            <BridgeTosStep
                visible={showBridgeTos}
                onComplete={() => {
                    hideTos()
                    handleCreateAndInitiateOfframp()
                }}
                onSkip={hideTos}
                reasonCode={gate.kind === 'accept-tos' ? gate.reason?.code : undefined}
            />

            <InitiateKycModal
                visible={showKycModal}
                onClose={() => {
                    // dismiss = abandon: clear the uplift latch so a later
                    // unrelated KYC success can't mis-fire eea_uplift_completed.
                    setShowKycModal(false)
                    resetUpliftFunnel()
                }}
                onVerify={async () => {
                    if (gate.kind === 'restart-identity') {
                        await sumsubFlow.handleRestartIdentity()
                    } else if (gate.kind === 'fixable-rejection') {
                        await sumsubFlow.handleSelfHealResubmit('BRIDGE')
                    } else {
                        await sumsubFlow.handleInitiateKyc(
                            getRegionIntent(getCountryFromPath(country)?.region ?? 'rest-of-the-world'),
                            undefined,
                            gate.kind === 'needs-enrollment' || undefined,
                            getCountryFromPath(country)?.id
                        )
                    }
                }}
                onContactSupport={() => {
                    setShowKycModal(false)
                    resetUpliftFunnel()
                    setIsSupportModalOpen(true)
                }}
                isLoading={sumsubFlow.isLoading}
                error={sumsubFlow.error}
                variant={resolveKycModalVariant(gate)}
                providerMessage={getGateUserMessage(gate)}
                regionName={getCountryFromPath(country)?.title}
            />
            <AdvisoryPreemptModal {...advisoryModalProps} />

            <KycReverificationPendingModal
                isOpen={pendingModal.isOpen}
                onClose={pendingModal.close}
                message={pendingModal.message}
            />
            <SumsubKycModals flow={sumsubFlow} />
        </div>
    )
}

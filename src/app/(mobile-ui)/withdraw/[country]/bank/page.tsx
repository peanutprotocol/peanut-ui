'use client'

import NavHeader from '@/components/Global/NavHeader'
import { useReturnTo } from '@/hooks/useSafeBack'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { KycReverificationPendingModal } from '@/components/Kyc/KycReverificationPendingModal'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { useModalsContext } from '@/context/ModalsContext'
import { resolveKycModalVariant, getGateUserMessage, getGateReasonCode } from '@/utils/capability-gate'
import { getCountryFromPath } from '@/utils/bridge.utils'
import { useBankRegionIntent } from '@/hooks/useBankRegionIntent'
import { shortenStringLong } from '@/utils/general.utils'
import { useLocale, useTranslations } from 'next-intl'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { useBridgeOfframpFlow } from '@/features/withdraw/useBridgeOfframpFlow'
import { WithdrawBankReviewView } from '@/features/withdraw/views/WithdrawBankReviewView'
import RateGateScreen from '@/components/Global/RateUnavailable/RateGateScreen'
import { payoutAmounts } from '@/features/withdraw/bank-amount'

/**
 * Bridge bank-withdraw review page. Steps live in the URL
 * (`?step=review|success`); the amount arrives as `?amount=` (or the typed
 * bank amount as `?destinationAmount=`) from the shared amount step; the
 * account comes from the /withdraw-scoped flow context.
 * Logic: useBridgeOfframpFlow. NOTE: scripts/native-build.js copies this file
 * to `(mobile-ui)/withdraw/_withdraw-bank.tsx` — keep every import `@/`-based.
 */
export default function WithdrawBankPage() {
    const locale = useLocale()
    const tNav = useTranslations('navigation')
    // rewinds to home past every entry the flow pushed; a replace kept the
    // earlier entries, so back from home re-entered the flow
    const leaveToHome = useReturnTo('/home')
    const flow = useBridgeOfframpFlow()
    const bankRegionIntent = useBankRegionIntent()
    const { setIsSupportModalOpen } = useModalsContext()

    const {
        step,
        amountToWithdraw,
        bankAccount,
        country,
        countryFromPath,
        fromSendFlow,
        gate,
        sumsubFlow,
        pendingModal,
        bankAmount,
    } = flow

    if (!bankAccount || !flow.payout) {
        return null
    }

    // the success screen shows what executed, never the still-editable URL (Chip round 8)
    const successAmounts = flow.executedAmountUsd
        ? payoutAmounts(flow.executedAmountUsd, flow.executedPayout ?? flow.payout)
        : null

    // the USDC for a typed bank amount comes from its quote — nothing to review
    // before the first one. A later refresh that fails keeps this page, and any
    // open KYC, terms or confirm step, mounted: the review shows the error inline.
    if (step === 'review' && bankAmount && !bankAmount.quote && !flow.isLoading && !flow.submittedTxHash) {
        return (
            <RateGateScreen
                title={fromSendFlow ? tNav('send') : tNav('withdraw')}
                onBack={flow.onBack}
                isLoading={!bankAmount.quoteFailed}
                onRetry={() => void bankAmount.refetchQuote()}
            />
        )
    }

    return (
        <div className="flex min-h-inherit w-full flex-col justify-start gap-8 self-start">
            <NavHeader
                title={fromSendFlow ? tNav('send') : tNav('withdraw')}
                icon={step === 'success' ? 'cancel' : undefined}
                onPrev={() => {
                    if (step === 'success') {
                        // the flow provider is /withdraw-scoped — navigation IS the reset
                        leaveToHome()
                    } else {
                        flow.onBack()
                    }
                }}
            />

            {step === 'review' && (
                <WithdrawBankReviewView
                    bankAccount={bankAccount}
                    amount={amountToWithdraw}
                    payout={flow.payout}
                    isRateLoading={flow.isRateLoading}
                    fromSendFlow={fromSendFlow}
                    verificationDeadline={flow.advisoryDeadline}
                    isLoading={flow.isLoading}
                    isSubmitReady={flow.isSubmitReady}
                    submittedTxHash={flow.submittedTxHash}
                    error={flow.error}
                    balanceErrorMessage={flow.balanceErrorMessage}
                    confirmPendingCopy={flow.confirmPendingCopy}
                    referenceSpec={flow.referenceSpec}
                    payoutNoteKey={flow.payoutNoteKey}
                    payoutDefaultReferenceNoteKey={flow.payoutDefaultReferenceNoteKey}
                    reference={flow.reference}
                    referenceProblem={flow.referenceProblem}
                    onReferenceChange={flow.setReference}
                    onSubmit={flow.handleCreateAndInitiateOfframp}
                    onDone={leaveToHome}
                    onRetryQuote={bankAmount?.quoteFailed ? () => void bankAmount.refetchQuote() : undefined}
                    onAddBankAccountAgain={flow.onAddBankAccountAgain}
                />
            )}

            {step === 'success' && successAmounts && (
                <PaymentSuccessView
                    isWithdrawFlow
                    isFromSendFlow={fromSendFlow}
                    currencyAmount={successAmounts.headline}
                    secondaryAmount={successAmounts.secondary}
                    message={bankAccount ? shortenStringLong(bankAccount.identifier.toUpperCase()) : ''}
                    points={flow.pointsData?.estimatedPoints}
                />
            )}

            <BridgeTosStep
                visible={flow.showBridgeTos}
                onComplete={() => {
                    flow.hideTos()
                    flow.handleCreateAndInitiateOfframp()
                }}
                onSkip={flow.hideTos}
                reasonCode={gate.kind === 'accept-tos' ? gate.reason?.code : undefined}
            />

            <InitiateKycModal
                cooldownActive={!!flow.sumsubFlow.errorCooldown}
                visible={flow.showKycModal}
                onClose={() => {
                    // dismiss = abandon: clear the uplift latch so a later
                    // unrelated KYC success can't mis-fire eea_uplift_completed.
                    flow.setShowKycModal(false)
                    flow.resetUpliftFunnel()
                }}
                onVerify={async () => {
                    if (gate.kind === 'restart-identity') {
                        await sumsubFlow.handleRestartIdentity()
                    } else if (gate.kind === 'fixable-rejection') {
                        // Through the shared router: it sends a residence park to the
                        // address step and everything else to resubmit as before.
                        await sumsubFlow.handleFixableGate('BRIDGE', gate)
                    } else {
                        await sumsubFlow.handleInitiateKyc(
                            bankRegionIntent(countryFromPath),
                            undefined,
                            gate.kind === 'needs-enrollment' || undefined,
                            getCountryFromPath(country)?.id
                        )
                    }
                }}
                onContactSupport={() => {
                    flow.setShowKycModal(false)
                    flow.resetUpliftFunnel()
                    setIsSupportModalOpen(true)
                }}
                isLoading={sumsubFlow.isLoading}
                error={sumsubFlow.error}
                variant={resolveKycModalVariant(gate)}
                providerMessage={getGateUserMessage(gate)}
                reasonCode={getGateReasonCode(gate)}
                regionName={countryFromPath && localizedCountryTitle(locale, countryFromPath)}
            />
            <KycReverificationPendingModal
                isOpen={pendingModal.isOpen}
                onClose={pendingModal.close}
                message={pendingModal.message}
            />
            <SumsubKycModals
                flow={flow.sumsubFlow}
                onCooldownClose={() => {
                    flow.setShowKycModal(false)
                    flow.resetUpliftFunnel()
                }}
            />
        </div>
    )
}

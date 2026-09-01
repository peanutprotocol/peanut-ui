'use client'

import NavHeader from '@/components/Global/NavHeader'
import { useRouter } from 'next/navigation'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { KycReverificationPendingModal } from '@/components/Kyc/KycReverificationPendingModal'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import AdvisoryPreemptModal from '@/components/Kyc/AdvisoryPreemptModal'
import { useModalsContext } from '@/context/ModalsContext'
import { resolveKycModalVariant, getGateUserMessage, getGateReasonCode } from '@/utils/capability-gate'
import { getCountryFromPath } from '@/utils/bridge.utils'
import { getRegionIntent } from '@/utils/regions.utils'
import { shortenStringLong } from '@/utils/general.utils'
import { useLocale, useTranslations } from 'next-intl'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { useBridgeOfframpFlow } from '@/features/withdraw/useBridgeOfframpFlow'
import { WithdrawBankReviewView } from '@/features/withdraw/views/WithdrawBankReviewView'

/**
 * Bridge bank-withdraw review page. Steps live in the URL
 * (`?step=review|success`); the amount arrives as `?amount=` from the shared
 * amount step; the account comes from the /withdraw-scoped flow context.
 * Logic: useBridgeOfframpFlow. NOTE: scripts/native-build.js copies this file
 * to `(mobile-ui)/withdraw/_withdraw-bank.tsx` — keep every import `@/`-based.
 */
export default function WithdrawBankPage() {
    const locale = useLocale()
    const tNav = useTranslations('navigation')
    const router = useRouter()
    const flow = useBridgeOfframpFlow()
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
    } = flow

    if (!bankAccount) {
        return null
    }

    return (
        <div className="flex min-h-[inherit] w-full flex-col justify-start gap-8 self-start">
            <NavHeader
                title={fromSendFlow ? tNav('send') : tNav('withdraw')}
                icon={step === 'success' ? 'cancel' : undefined}
                onPrev={() => {
                    if (step === 'success') {
                        // the flow provider is /withdraw-scoped — navigation IS the reset
                        router.push('/home')
                    } else {
                        flow.onBack()
                    }
                }}
            />

            {step === 'review' && (
                <WithdrawBankReviewView
                    bankAccount={bankAccount}
                    amount={amountToWithdraw}
                    country={country}
                    fromSendFlow={fromSendFlow}
                    isLoading={flow.isLoading}
                    submittedTxHash={flow.submittedTxHash}
                    error={flow.error}
                    balanceErrorMessage={flow.balanceErrorMessage}
                    confirmPendingCopy={flow.confirmPendingCopy}
                    onSubmit={flow.handleCreateAndInitiateOfframp}
                    onDone={() => router.push('/home')}
                />
            )}

            {step === 'success' && (
                <PaymentSuccessView
                    isWithdrawFlow
                    isFromSendFlow={fromSendFlow}
                    currencyAmount={`$${amountToWithdraw}`}
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
            <AdvisoryPreemptModal {...flow.advisoryModalProps} />

            <KycReverificationPendingModal
                isOpen={pendingModal.isOpen}
                onClose={pendingModal.close}
                message={pendingModal.message}
            />
            <SumsubKycModals flow={sumsubFlow} />
        </div>
    )
}

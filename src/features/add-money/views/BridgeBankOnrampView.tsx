'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { FieldColumn } from '@/components/0_Bruddle/FieldColumn'
import { Notification } from '@/components/0_Bruddle/Notification'
import AddMoneyBankDetails from '@/components/AddMoney/components/AddMoneyBankDetails'
import { OnrampConfirmationModal } from '@/components/AddMoney/components/OnrampConfirmationModal'
import AmountInput from '@/components/Global/AmountInput'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import RateUnavailable from '@/components/Global/RateUnavailable'
import AdvisoryPreemptModal from '@/components/Kyc/AdvisoryPreemptModal'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { KycReverificationPendingModal } from '@/components/Kyc/KycReverificationPendingModal'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { getLimitsWarningCardProps } from '@/features/limits/utils'
import { getCurrencyConfig, getCurrencySymbol } from '@/utils/bridge.utils'
import {
    resolveKycModalVariant,
    getGateUserMessage,
    getGateReasonCode,
    isDepositStepReady,
} from '@/utils/capability-gate'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { useBridgeBankFlow } from '../useBridgeBankFlow'

// The Bridge SEPA bank deposit page. Only mounted for non-Manteca countries — the
// AddMoneyBankPage wrapper bounces BR/AR away before this ever renders, so none of
// its data hooks / URL-state effects run for a Manteca deep link.
export function BridgeBankOnrampView() {
    const {
        urlState,
        setUrlState,
        user,
        selectedCountry,
        onBack,
        locale,
        t,
        tCommon,
        tUnlock,
        gate,
        sumsubFlow,
        handleVerify,
        pendingModal,
        advisoryModalProps,
        showBridgeTos,
        hideTos,
        setIsSupportModalOpen,
        resetUpliftFunnel,
        rawTokenAmount,
        handleTokenAmountChange,
        peanutWalletBalance,
        minimumAmount,
        validationError,
        limitsValidation,
        isNonEuroSepa,
        isUK,
        localCurrency,
        isRateLoading,
        isRateError,
        refetchRate,
        error,
        isCreatingOnramp,
        handleAmountContinue,
        showWarningModal,
        handleWarningConfirm,
        handleWarningCancel,
        showKycModal,
        setShowKycModal,
        onrampData,
    } = useBridgeBankFlow()

    // Show loading while user is being fetched and no step in URL yet
    if (!urlState.step && user === null) {
        return <Loading variant="mascot" />
    }

    if (!selectedCountry) {
        return (
            <div className="space-y-8 self-start">
                <NavHeader title={tCommon('notFound')} onPrev={onBack} />
                <EmptyState
                    title={tCommon('countryNotFound')}
                    description={tCommon('tryDifferentCountry')}
                    icon="search"
                />
            </div>
        )
    }

    // Still determining initial step
    if (!urlState.step) {
        return <Loading variant="mascot" />
    }

    // A persisted step is not evidence of anything until the gate answers —
    // see isDepositStepReady.
    if (!isDepositStepReady(urlState.step, gate.kind)) {
        return <Loading variant="mascot" />
    }

    if (urlState.step === 'showDetails') {
        // Show loading while useEffect redirects if data is missing
        if (!onrampData?.transferId) {
            return <Loading variant="mascot" />
        }
        return <AddMoneyBankDetails onBack={() => setUrlState({ step: 'inputAmount' })} />
    }

    if (urlState.step === 'verify') {
        return (
            <>
                {/* The verify CTA starts the Sumsub run, so its host has to be
                    mounted in THIS branch — the inputAmount branch below is not
                    rendered here, and without this the button was a dead end. */}
                <SumsubKycModals flow={sumsubFlow} onCooldownClose={onBack} />
                <InitiateKycModal
                    cooldownActive={!!sumsubFlow.errorCooldown}
                    visible
                    presentation="page"
                    navTitle={tUnlock('title')}
                    onBack={onBack}
                    onClose={onBack}
                    onVerify={handleVerify}
                    onContactSupport={() => setIsSupportModalOpen(true)}
                    isLoading={sumsubFlow.isLoading}
                    error={sumsubFlow.error}
                    variant={resolveKycModalVariant(gate)}
                    providerMessage={getGateUserMessage(gate)}
                    reasonCode={getGateReasonCode(gate)}
                    regionName={selectedCountry && localizedCountryTitle(locale, selectedCountry)}
                />
            </>
        )
    }

    if (urlState.step === 'inputAmount') {
        const showLimitsCard = limitsValidation.isBlocking || limitsValidation.isWarning

        return (
            <div className="space-y-8 flex flex-col justify-start">
                <NavHeader title={t('title')} onPrev={onBack} />
                <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                    <div className="text-label-l">{t('howMuchToAdd')}</div>
                    {/* only show the field error if limits blocking card is not displayed (warnings can coexist) */}
                    <FieldColumn error={!limitsValidation.isBlocking ? validationError : undefined}>
                        <AmountInput
                            initialAmount={rawTokenAmount}
                            setPrimaryAmount={handleTokenAmountChange}
                            walletBalance={peanutWalletBalance}
                            primaryDenomination={
                                selectedCountry
                                    ? {
                                          symbol: getCurrencySymbol(
                                              getCurrencyConfig(selectedCountry.id, 'onramp').currency
                                          ),
                                          price: 1,
                                          decimals: 2,
                                      }
                                    : undefined
                            }
                            hideBalance
                        />
                    </FieldColumn>

                    {/* limits warning/error card */}
                    {showLimitsCard &&
                        (() => {
                            const limitsCardProps = getLimitsWarningCardProps({
                                validation: limitsValidation,
                                flowType: 'onramp',
                                currency: 'USD',
                            })
                            return limitsCardProps ? <LimitsWarningCard {...limitsCardProps} /> : null
                        })()}

                    {!limitsValidation.isBlocking && (
                        <Notification priority="attention">{t('amountMustMatchBank')}</Notification>
                    )}

                    {/* Warning for non-EUR SEPA countries (not UK — UK uses Faster Payments with GBP) */}
                    {!limitsValidation.isBlocking && isNonEuroSepa && !isUK && (
                        <Notification priority="info" title={t('eurAccountsOnlyTitle')}>
                            {t('eurAccountsOnlyDescription')}
                        </Notification>
                    )}
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={handleAmountContinue}
                        disabled={
                            !parseFloat(rawTokenAmount) ||
                            parseFloat(rawTokenAmount) < minimumAmount ||
                            error.showError ||
                            !!validationError ||
                            isCreatingOnramp ||
                            limitsValidation.isBlocking ||
                            // fail closed: without a rate the limit check can't run, so don't
                            // let an unchecked deposit through on a failed FX fetch
                            (localCurrency !== 'USD' && (isRateLoading || isRateError))
                        }
                        className="w-full"
                        loading={isCreatingOnramp || (localCurrency !== 'USD' && isRateLoading)}
                    >
                        {tCommon('continue')}
                    </Button>
                    {/* only show error if limits blocking card is not displayed (warnings can coexist) */}
                    {error.showError && !!error.errorMessage && !limitsValidation.isBlocking && (
                        <Notification priority="error">{error.errorMessage}</Notification>
                    )}
                    {localCurrency !== 'USD' && isRateError && <RateUnavailable onRetry={refetchRate} />}
                </div>

                <OnrampConfirmationModal
                    visible={showWarningModal}
                    onClose={handleWarningCancel}
                    onConfirm={handleWarningConfirm}
                    amount={rawTokenAmount}
                    currency={getCurrencySymbol(getCurrencyConfig(selectedCountry.id, 'onramp').currency)}
                />

                <InitiateKycModal
                    cooldownActive={!!sumsubFlow.errorCooldown}
                    visible={showKycModal}
                    onClose={() => {
                        // dismiss = abandon: clear the uplift latch so a later
                        // unrelated KYC success can't mis-fire eea_uplift_completed.
                        setShowKycModal(false)
                        resetUpliftFunnel()
                    }}
                    onVerify={handleVerify}
                    onContactSupport={() => {
                        setShowKycModal(false)
                        resetUpliftFunnel()
                        setIsSupportModalOpen(true)
                    }}
                    isLoading={sumsubFlow.isLoading}
                    error={sumsubFlow.error}
                    variant={resolveKycModalVariant(gate)}
                    providerMessage={getGateUserMessage(gate)}
                    reasonCode={getGateReasonCode(gate)}
                    regionName={selectedCountry && localizedCountryTitle(locale, selectedCountry)}
                />

                <AdvisoryPreemptModal {...advisoryModalProps} />

                <KycReverificationPendingModal
                    isOpen={pendingModal.isOpen}
                    onClose={pendingModal.close}
                    message={pendingModal.message}
                />

                <SumsubKycModals
                    flow={sumsubFlow}
                    onCooldownClose={() => {
                        setShowKycModal(false)
                        resetUpliftFunnel()
                    }}
                />

                <BridgeTosStep
                    visible={showBridgeTos}
                    onComplete={() => {
                        hideTos()
                        handleWarningConfirm()
                    }}
                    onSkip={hideTos}
                    reasonCode={gate.kind === 'accept-tos' ? gate.reason?.code : undefined}
                />
            </div>
        )
    }

    return null
}

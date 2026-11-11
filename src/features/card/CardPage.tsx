'use client'
import { useRouter } from 'next/navigation'
import { type FC, useCallback, useEffect, useState } from 'react'
import type { StopAttempt } from '@/hooks/useCardStopConfirmation'
import { useTranslations } from 'next-intl'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { CardAcquisitionScreen, CardMilestoneScreen } from './components/CardAcquisitionScreen'
import { readStoredValue, removeStoredValue } from '@/utils/safe-storage'
import ApplicationStatusScreen from '@/components/Card/ApplicationStatusScreen'
import CardTermsScreen from '@/components/Card/CardTermsScreen'
import CardCountryConfirmScreen from '@/components/Card/CardCountryConfirmScreen'
import YourCardScreen from '@/components/Card/YourCardScreen'
import CardStopBanner from '@/components/Card/CardStopBanner'
import Loading from '@/components/Global/Loading'
import { Button } from '@/components/0_Bruddle/Button'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import CenteredStatusCard from '@/components/Global/EmptyStates/CenteredStatusCard'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { initiateSelfHealResubmission } from '@/app/actions/sumsub'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { CardResidenceAddressScreen } from './components/CardResidenceAddressScreen'
import { useCardFlow } from './useCardFlow'
import { KycFeatureActivationStatus } from '@/features/paperwork-verification/KycFeatureActivationStatus'
import { IdentityRejectedScreen, isDecidedRejection } from '@/features/paperwork-verification/PaperworkVerificationFlow'
import { AddFeatureQuestions } from '@/features/paperwork-verification/AddFeatureFlow'
import { IdentityCheckIntroScreen } from '@/features/paperwork-verification/components/IdentityCheckIntroScreen'
import { KycControlFlowProvider } from '@/features/paperwork-verification/analytics'
import { useCardVerificationContinuation } from './useCardVerificationContinuation'

const PROOF_OF_ADDRESS_RECEIVED = 'proof_of_address_received'

export const CardPage: FC = () => {
    const t = useTranslations('card')
    const tCommon = useTranslations('common')
    const {
        user,
        activation,
        cardInfo,
        isCardFunded,
        isBalanceKnown,
        needsFundingBeforeApply,
        termsFundingPath,
        fundingAccessLoading,
        refetchFundingAccess,
        fundingRequired,
        fetchUser,
        cardInfoError,
        refetchCardInfo,
        refetchOverview,
        retryIssuance,
        issuanceReadError,
        overview,
        overviewError,
        residenceAddressStep,
        addressStarting,
        refreshResidenceAddress,
        capabilitiesLoading,
        railsForProvider,
        state,
        applyError,
        supportRequiredReason,
        setApplyError,
        pendingTerms,
        setPendingTerms,
        pendingCountryConfirmation,
        setPendingCountryConfirmation,
        isIssuing,
        geoBlocked,
        pendingResidenceBlocked,
        planRefusal,
        setPlanRefusal,
        pendingQuestions,
        pendingApplication,
        setPendingQuestions,
        handleQuestionsDone,
        kycFlow,
        handleApply,
        handleConfirmCountry,
        handleAcceptTerms,
        invalidateOverview,
        poaToken,
        setPoaToken,
        poaError,
        poaSubmitted,
        setPoaSubmitted,
        onUploadProofOfAddress,
        onUploadIdentity,
        identityUploadError,
        informationActions,
        informationSession,
        setInformationSession,
        informationError,
        startInformationAction,
        refreshInformationToken,
        sumsubToken,
        handleSumsubComplete,
        handleSumsubClose,
        handleSumsubRefreshToken,
        setIsSupportModalOpen,
        onBack,
    } = useCardFlow()
    const router = useRouter()
    const cardVerification = useCardVerificationContinuation(
        user?.user?.userId,
        state === 'active' ? overview?.pendingVerification : undefined,
        state === 'active' ? overview?.verificationContext : { status: 'none' },
        invalidateOverview,
        fetchUser
    )
    // Outlives the card screen: a cancel can remove the last card while the stop is still pending.
    const [stopAttempt, setStopAttempt] = useState<StopAttempt | null>(null)
    const clearStopAttempt = useCallback(() => setStopAttempt(null), [])

    const celebrationKey = `card_issuance_celebration_pending_v1:${user?.user.userId}`
    const [showIssuedCelebration, setShowIssuedCelebration] = useState(false)
    useEffect(() => {
        setShowIssuedCelebration(state === 'active' && readStoredValue(celebrationKey) === '1')
    }, [state, celebrationKey])

    // A legacy applicant's first ID check runs in the card level's Sumsub: it
    // opens behind /verify's intro, like every other start. A verified user's
    // token (the card questions, a missing selfie) opens Sumsub at once.
    const [introDoneFor, setIntroDoneFor] = useState<string | null>(null)
    const showCardIntro =
        sumsubToken !== null && user?.identityVerification?.status === 'not_started' && introDoneFor !== sumsubToken

    if (state === 'loading') {
        return (
            <PageContainer>
                <div className="flex min-h-inherit w-full items-center justify-center">
                    <Loading />
                </div>
            </PageContainer>
        )
    }

    if (cardInfoError || overviewError || issuanceReadError) {
        return (
            <PageContainer>
                <div className="flex min-h-inherit w-full flex-col items-center justify-center gap-4 p-4">
                    <CenteredStatusCard title={tCommon('cardCouldNotLoad')} description={t('page.loadFailed')}>
                        <Button
                            onClick={() => {
                                void refetchCardInfo()
                                if (issuanceReadError || state === 'creating-card') void retryIssuance()
                                else void refetchOverview()
                            }}
                            variant="primary"
                            shadowSize="4"
                        >
                            {tCommon('retry')}
                        </Button>
                    </CenteredStatusCard>
                </div>
            </PageContainer>
        )
    }

    const stopBanner = (
        <CardStopBanner
            key={stopAttempt?.attemptId}
            enabled={!!overview?.status?.hasApplication}
            attempt={stopAttempt}
            onSettled={clearStopAttempt}
        />
    )

    const renderState = () => {
        if (supportRequiredReason && state !== 'active') {
            return (
                <ApplicationStatusScreen
                    variant="requires-support"
                    reasonCode={supportRequiredReason}
                    onContactSupport={() => setIsSupportModalOpen(true)}
                    onPrev={onBack}
                />
            )
        }
        // A finally rejected identity cannot apply: its reason and the way on, as /verify shows them.
        if (state !== 'active' && isDecidedRejection(user?.identityVerification)) {
            return <IdentityRejectedScreen onHome={() => router.replace('/home')} />
        }
        if (
            residenceAddressStep &&
            state !== 'active' &&
            state !== 'geo-blocked' &&
            !overview?.status.hasApplication &&
            !planRefusal &&
            !geoBlocked &&
            !pendingResidenceBlocked
        ) {
            return (
                <CardResidenceAddressScreen
                    state={residenceAddressStep}
                    loading={addressStarting}
                    error={kycFlow.error}
                    onStart={() => void handleApply(false)}
                    onRefresh={refreshResidenceAddress}
                    onBack={onBack}
                />
            )
        }
        // Highest priority: show the issuance spinner between "terms accepted"
        // and the overview refetch landing. Keeps the UX from flipping back
        // to Add Card for a split second while the API call is in flight.
        // `onPrev` is not optional here: this screen carries no other control,
        // so omitting it made a poll that ran long (or never resolved) read as
        // a frozen app — animations running, nothing tappable.
        if (activation && !activation.allowed && (activation.result || activation.isLoading)) {
            return (
                <KycFeatureActivationStatus
                    feature="card"
                    result={activation.result}
                    isLoading={activation.isLoading}
                    onRetry={() => void activation.activate()}
                    onBack={onBack}
                />
            )
        }
        if (isIssuing) {
            return <ApplicationStatusScreen variant="pending" onPrev={onBack} />
        }
        if (pendingApplication && state === 'add-card') {
            return <ApplicationStatusScreen variant={pendingApplication} onPrev={onBack} />
        }
        // Terminal regulatory block detected mid-funnel by the BE apply gate —
        // takes precedence over the confirmation/terms overlays (those flows
        // are moot once the country verdict is in).
        if (geoBlocked) {
            return <ApplicationStatusScreen variant="geo-blocked" onPrev={onBack} />
        }
        if (pendingResidenceBlocked) {
            return <ApplicationStatusScreen variant="pending-residence-blocked" onPrev={onBack} />
        }
        // A supplement start the backend refused for good: support is the way on.
        if (kycFlow.isTerminalError && kycFlow.error) {
            return (
                <ApplicationStatusScreen
                    variant="requires-info"
                    reasonMessage={kycFlow.error}
                    onContactSupport={() => setIsSupportModalOpen(true)}
                    onPrev={onBack}
                />
            )
        }
        // Smart Paperwork Verification: the card's own questions on one full screen over the page, then the application resumes.
        if (pendingQuestions) {
            return (
                <div className="fixed inset-0 z-30 overflow-y-auto bg-white pt-safe-top pb-safe-bottom">
                    <AddFeatureQuestions
                        feature="card"
                        requiredStep={pendingQuestions}
                        onBack={() => setPendingQuestions(null)}
                        onDone={handleQuestionsDone}
                    />
                </div>
            )
        }
        if (planRefusal) {
            return (
                <ApplicationStatusScreen
                    variant="requires-info"
                    reasonCode={planRefusal}
                    onContactSupport={() => setIsSupportModalOpen(true)}
                    onUploadIdentity={
                        planRefusal === 'identity_document_insufficient' ||
                        planRefusal === 'document_country_unsupported'
                            ? () => void kycFlow.handleRestartIdentity()
                            : undefined
                    }
                    uploadError={kycFlow.error ?? undefined}
                    onPrev={() => setPlanRefusal(null)}
                />
            )
        }
        // Residence confirmation comes before terms in the funnel — the
        // backend won't return terms-required until the country is resolved.
        if (pendingCountryConfirmation) {
            return (
                <CardCountryConfirmScreen
                    candidates={pendingCountryConfirmation.candidates}
                    onConfirm={handleConfirmCountry}
                    onContactSupport={() => setIsSupportModalOpen(true)}
                    onPrev={() => {
                        // Clear the shared error too — a confirm failure must not
                        // leak onto the entry/terms screens after backing out.
                        setPendingCountryConfirmation(null)
                        setApplyError(null)
                    }}
                    submitError={applyError}
                />
            )
        }
        // Terms screen takes precedence over the state-machine target — the
        // user already clicked "Get your card" or completed Sumsub; we need
        // to collect consent before letting them back out to Add Card.
        if (fundingRequired) {
            return (
                <CardAcquisitionScreen
                    userId={user?.user.userId ?? ''}
                    eligible={true}
                    funded={isCardFunded}
                    balanceKnown={isBalanceKnown}
                    needsFundingBeforeApply={needsFundingBeforeApply}
                    fundingRequired
                    onApply={() => handleApply(false)}
                    onPrev={onBack}
                />
            )
        }
        if (pendingTerms) {
            // The terms differ by funding path, so they wait for the server's
            // decision; an unreadable decision offers a retry, never a guess.
            if (!termsFundingPath) {
                return fundingAccessLoading ? (
                    <div className="flex min-h-inherit w-full items-center justify-center">
                        <Loading />
                    </div>
                ) : (
                    <div className="flex min-h-inherit w-full flex-col items-center justify-center gap-4 p-4">
                        <CenteredStatusCard title={tCommon('cardCouldNotLoad')} description={t('page.loadFailed')}>
                            <Button onClick={() => void refetchFundingAccess()} variant="primary" shadowSize="4">
                                {tCommon('retry')}
                            </Button>
                        </CenteredStatusCard>
                    </div>
                )
            }
            return (
                <CardTermsScreen
                    isUsResident={pendingTerms.isUsResident}
                    managedFunding={termsFundingPath === 'managed'}
                    onAccept={handleAcceptTerms}
                    onPrev={() => setPendingTerms(null)}
                    submitError={applyError}
                />
            )
        }
        switch (state) {
            case 'creating-card':
                return <ApplicationStatusScreen variant="creating-card" onPrev={onBack} />
            case 'add-card':
                return (
                    <CardAcquisitionScreen
                        key={user?.user.userId}
                        userId={user?.user.userId ?? ''}
                        eligible={
                            !!cardInfo?.isEligible &&
                            !overview?.status.hasApplication &&
                            overview?.status.railStatus !== 'ENABLED'
                        }
                        funded={isCardFunded}
                        balanceKnown={isBalanceKnown}
                        needsFundingBeforeApply={needsFundingBeforeApply}
                        fundingRequired={fundingRequired}
                        onApply={() => handleApply(false)}
                        onPrev={onBack}
                        applyError={applyError ?? kycFlow.error}
                    />
                )
            case 'pending':
                return <ApplicationStatusScreen variant="pending" onPrev={onBack} />
            case 'manual-review':
                return <ApplicationStatusScreen variant="manual-review" onPrev={onBack} />
            case 'requires-info': {
                // Surface the structured remediation reason from the
                // capabilities read-model — `rail.reason.userMessage` is
                // display-ready and provider-neutral by contract. The card
                // provider serves exactly one rail, so [0] is the card rail.
                // Overview and capabilities load independently — wait for
                // capabilities so the screen never flashes without its reason.
                if (capabilitiesLoading) {
                    return (
                        <div className="flex min-h-inherit w-full items-center justify-center">
                            <Loading />
                        </div>
                    )
                }
                const cardRail = railsForProvider('rain')[0]
                const cardRailReasonCode = poaSubmitted ? PROOF_OF_ADDRESS_RECEIVED : cardRail?.reason?.code
                const cardRailReason = poaSubmitted ? undefined : cardRail?.reason?.userMessage
                return (
                    <ApplicationStatusScreen
                        variant="requires-info"
                        reasonMessage={cardRailReason}
                        reasonCode={cardRailReasonCode}
                        onContactSupport={() => setIsSupportModalOpen(true)}
                        onUploadProofOfAddress={onUploadProofOfAddress}
                        onUploadIdentity={onUploadIdentity}
                        informationActions={informationActions.map((action) => {
                            const kind = action.levelKey === 'tax_identification_number' ? 'taxId' : 'birthDate'
                            return {
                                key: action.key,
                                kind,
                                label: t(kind === 'taxId' ? 'provideTaxId' : 'provideBirthDate'),
                                onClick: () => void startInformationAction(action.key),
                            }
                        })}
                        uploadError={informationError ?? poaError ?? identityUploadError ?? undefined}
                        onPrev={onBack}
                    />
                )
            }
            case 'requires-support':
                // Pipeline-side failure — nothing the user can re-submit.
                // Same support deep-link as 'rejected' below.
                return (
                    <ApplicationStatusScreen
                        variant="requires-support"
                        onContactSupport={() => setIsSupportModalOpen(true)}
                        onPrev={onBack}
                    />
                )
            case 'geo-blocked':
                // Regulatory dead end (country on Rain's prohibited-issuance
                // list) — no support CTA, support can't override regulation.
                return <ApplicationStatusScreen variant="geo-blocked" onPrev={onBack} />
            case 'rejected': {
                // No retry CTA: Rain denials are terminal on our side. The
                // only path forward is support reviewing the case manually
                // (PEP / sanctions / fraud-pattern flags need a human in the
                // loop on Rain's end). Open Crisp directly — sending the user
                // to /support's FAQ first adds a step for no upside.
                //
                // Surface the specific, vetted rejection reason from the
                // capabilities read-model (`rail.reason.userMessage` — e.g.
                // "Peanut cards aren't available in your state yet."). Render
                // immediately rather than spinner-gating: unlike requires-info
                // (meaningless without its reason), the rejected screen is useful
                // on its own (reassurance + support CTA), so show it now and let
                // the reason fill in once capabilities resolve.
                const cardRail = capabilitiesLoading ? undefined : railsForProvider('rain')[0]
                const cardRailReasonCode = poaSubmitted ? PROOF_OF_ADDRESS_RECEIVED : cardRail?.reason?.code
                const cardRailReason = poaSubmitted ? undefined : cardRail?.reason?.userMessage
                return (
                    <ApplicationStatusScreen
                        variant="rejected"
                        reasonMessage={cardRailReason}
                        reasonCode={cardRailReasonCode}
                        onContactSupport={() => setIsSupportModalOpen(true)}
                        onUploadProofOfAddress={onUploadProofOfAddress}
                        uploadError={poaError ?? undefined}
                        onPrev={onBack}
                    />
                )
            }
            case 'active': {
                if (showIssuedCelebration) {
                    return (
                        <CardMilestoneScreen
                            issued
                            onContinue={() => {
                                removeStoredValue(celebrationKey)
                                setShowIssuedCelebration(false)
                            }}
                        />
                    )
                }
                const card = findActiveCard(overview)!
                return (
                    <YourCardScreen
                        overview={overview!}
                        card={card}
                        onPrev={onBack}
                        onStopAttempt={setStopAttempt}
                        statusWarning={stopBanner}
                        onCompleteVerification={
                            cardVerification.available ? () => void cardVerification.start() : undefined
                        }
                        verificationBusy={cardVerification.busy}
                        verificationError={cardVerification.error}
                    />
                )
            }
            default:
                return null
        }
    }

    const screen = renderState()
    return (
        <PageContainer>
            <div className="flex min-h-inherit flex-col gap-6">
                {screen?.type !== YourCardScreen && stopBanner}
                {screen}
            </div>
            <KycControlFlowProvider value="kyc_provider_request">
                <SumsubKycWrapper
                    visible={poaToken !== null}
                    accessToken={poaToken}
                    onClose={() => setPoaToken(null)}
                    onComplete={() => {
                        // Document submitted to Sumsub. Review + the backend webhook
                        // stamp happen async — flip the optimistic banner and refetch
                        // so the screen picks up the backend's wait state when ready.
                        setPoaToken(null)
                        setPoaSubmitted(true)
                        invalidateOverview()
                        void fetchUser()
                    }}
                    onRefreshToken={async () => {
                        const response = await initiateSelfHealResubmission('RAIN')
                        if (!response.data?.token) throw new Error(response.error ?? 'Failed to refresh token')
                        return response.data.token
                    }}
                />
            </KycControlFlowProvider>
            <SumsubKycModals flow={kycFlow} />
            <KycControlFlowProvider value="kyc_provider_request">
                <SumsubKycWrapper
                    sessionKey={informationSession?.key}
                    visible={informationSession !== null}
                    accessToken={informationSession?.token ?? null}
                    onClose={() => setInformationSession(null)}
                    onComplete={() => {
                        markSubmitted()
                        setInformationSession(null)
                        invalidateOverview()
                        void fetchUser()
                    }}
                    onRefreshToken={refreshInformationToken}
                />
            </KycControlFlowProvider>
            <IdentityCheckIntroScreen
                visible={showCardIntro}
                hasQuestions
                providerId="third-national"
                providerLabel="cardProvider"
                onBack={handleSumsubClose}
                onContinue={() => setIntroDoneFor(sumsubToken)}
            />
            <SumsubKycWrapper
                visible={sumsubToken !== null && !showCardIntro}
                accessToken={sumsubToken}
                onClose={handleSumsubClose}
                onComplete={handleSumsubComplete}
                onRefreshToken={handleSumsubRefreshToken}
            />
            <SumsubKycWrapper
                visible={!!cardVerification.active}
                accessToken={cardVerification.active?.token ?? null}
                sessionKey={cardVerification.active?.action.generation}
                onClose={cardVerification.finish}
                onComplete={cardVerification.finish}
                onRefreshToken={cardVerification.refresh}
            />
        </PageContainer>
    )
}

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
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import CenteredStatusCard from '@/components/Global/EmptyStates/CenteredStatusCard'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { initiateSelfHealResubmission } from '@/app/actions/sumsub'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { CardResidenceAddressScreen } from './components/CardResidenceAddressScreen'
import { useCardFlow } from './useCardFlow'
import { resolveCardViewState, type CardViewState } from './cardViewState'
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
        spendableUsd,
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
        issuanceStillCreating,
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

    const activeCard = state === 'active' ? findActiveCard(overview) : null
    const view: CardViewState = resolveCardViewState({
        hasLoadError: !!(cardInfoError || overviewError || issuanceReadError),
        state,
        issuanceStillCreating,
        supportRequiredReason,
        isIdentityRejected: isDecidedRejection(user?.identityVerification),
        hasResidenceAddressStep: !!residenceAddressStep,
        hasApplication: !!overview?.status.hasApplication,
        hasActivationOverlay: !!(
            activation &&
            !activation.allowed &&
            (activation.reverification || activation.result || activation.isLoading)
        ),
        isIssuing,
        pendingApplication,
        geoBlocked,
        pendingResidenceBlocked,
        terminalKycError: kycFlow.isTerminalError && kycFlow.error ? kycFlow.error : null,
        hasPendingQuestions: !!pendingQuestions,
        planRefusal,
        hasPendingCountryConfirmation: !!pendingCountryConfirmation,
        fundingRequired,
        hasPendingTerms: !!pendingTerms,
        hasTermsFundingPath: !!termsFundingPath,
        fundingAccessLoading,
        capabilitiesLoading,
        showIssuedCelebration,
        hasActiveCard: !!overview && !!activeCard,
    })

    if (view.kind === 'load-error') {
        return (
            <PageContainer>
                <div className="flex min-h-inherit w-full flex-col items-center justify-center gap-4 p-4">
                    <CenteredStatusCard title={tCommon('cardCouldNotLoad')} description={t('page.loadFailed')}>
                        <div className="flex w-full flex-col items-center gap-6">
                            <Button
                                onClick={() => {
                                    void refetchCardInfo()
                                    if (issuanceReadError || state === 'creating-card') void retryIssuance()
                                    else void refetchOverview()
                                }}
                                variant="primary"
                                shadowSize="4"
                                className="w-full justify-center"
                            >
                                {tCommon('retry')}
                            </Button>
                            <LinkButton onClick={() => setIsSupportModalOpen(true)}>
                                {tCommon('contactSupport')}
                            </LinkButton>
                        </div>
                    </CenteredStatusCard>
                </div>
            </PageContainer>
        )
    }

    if (view.kind === 'loading') {
        return (
            <PageContainer>
                <div className="flex min-h-inherit w-full items-center justify-center">
                    <Loading />
                </div>
            </PageContainer>
        )
    }

    if (view.kind === 'issuance-still-creating') {
        return (
            <PageContainer>
                <div className="flex min-h-inherit w-full flex-col items-center justify-center gap-4 p-4">
                    <CenteredStatusCard title={t('status.stillCreatingTitle')}>
                        <div className="flex w-full flex-col items-center gap-6">
                            <Button
                                onClick={() => void retryIssuance()}
                                variant="primary"
                                shadowSize="4"
                                className="w-full justify-center"
                            >
                                {tCommon('retry')}
                            </Button>
                            <LinkButton onClick={() => setIsSupportModalOpen(true)}>
                                {tCommon('contactSupport')}
                            </LinkButton>
                        </div>
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
        switch (view.kind) {
            case 'support-required':
                return (
                    <ApplicationStatusScreen
                        variant="requires-support"
                        reasonCode={view.reasonCode}
                        onContactSupport={() => setIsSupportModalOpen(true)}
                        onPrev={onBack}
                    />
                )
            case 'identity-rejected':
                return <IdentityRejectedScreen onHome={() => router.replace('/home')} />
            case 'residence-address':
                return (
                    <CardResidenceAddressScreen
                        state={residenceAddressStep!}
                        loading={addressStarting}
                        error={kycFlow.error}
                        onStart={() => void handleApply(false)}
                        onRefresh={refreshResidenceAddress}
                        onBack={onBack}
                    />
                )
            case 'feature-activation':
                return (
                    <KycFeatureActivationStatus
                        feature="card"
                        reverification={activation!.reverification}
                        result={activation!.result}
                        isLoading={activation!.isLoading}
                        onRetry={() => void activation!.activate()}
                        onBack={onBack}
                    />
                )
            case 'issuing':
                return <ApplicationStatusScreen variant="pending" onPrev={onBack} />
            case 'pending-application':
                return <ApplicationStatusScreen variant={view.variant} onPrev={onBack} />
            case 'geo-blocked-overlay':
            case 'geo-blocked':
                return <ApplicationStatusScreen variant="geo-blocked" onPrev={onBack} />
            case 'pending-residence-blocked':
                return <ApplicationStatusScreen variant="pending-residence-blocked" onPrev={onBack} />
            case 'terminal-kyc-error':
                return (
                    <ApplicationStatusScreen
                        variant="requires-support"
                        reasonMessage={view.message}
                        onContactSupport={() => setIsSupportModalOpen(true)}
                        onPrev={onBack}
                    />
                )
            case 'pending-questions':
                return (
                    <div className="fixed inset-0 z-30 overflow-y-auto bg-white pt-safe-top pb-safe-bottom">
                        <AddFeatureQuestions
                            feature="card"
                            requiredStep={pendingQuestions!}
                            onBack={() => setPendingQuestions(null)}
                            onDone={handleQuestionsDone}
                        />
                    </div>
                )
            case 'plan-refusal':
                return (
                    <ApplicationStatusScreen
                        variant={view.canReupload ? 'requires-info' : 'requires-support'}
                        reasonCode={view.reasonCode}
                        onContactSupport={() => setIsSupportModalOpen(true)}
                        onUploadIdentity={view.canReupload ? () => void kycFlow.handleRestartIdentity() : undefined}
                        uploadError={kycFlow.error ?? undefined}
                        onPrev={() => setPlanRefusal(null)}
                    />
                )
            case 'country-confirmation':
                return (
                    <CardCountryConfirmScreen
                        candidates={pendingCountryConfirmation!.candidates}
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
            case 'funding-required':
                return (
                    <CardAcquisitionScreen
                        userId={user?.user.userId ?? ''}
                        eligible={true}
                        funded={isCardFunded}
                        balanceKnown={isBalanceKnown}
                        spendableUsd={spendableUsd}
                        needsFundingBeforeApply={needsFundingBeforeApply}
                        fundingRequired
                        onApply={() => handleApply(false)}
                        onPrev={onBack}
                    />
                )
            case 'terms-loading':
            case 'requires-info-loading':
                return (
                    <div className="flex min-h-inherit w-full items-center justify-center">
                        <Loading />
                    </div>
                )
            case 'terms-load-error':
                return (
                    <div className="flex min-h-inherit w-full flex-col items-center justify-center gap-4 p-4">
                        <CenteredStatusCard title={tCommon('cardCouldNotLoad')} description={t('page.loadFailed')}>
                            <Button onClick={() => void refetchFundingAccess()} variant="primary" shadowSize="4">
                                {tCommon('retry')}
                            </Button>
                        </CenteredStatusCard>
                    </div>
                )
            case 'terms':
                return (
                    <CardTermsScreen
                        isUsResident={pendingTerms!.isUsResident}
                        managedFunding={termsFundingPath === 'managed'}
                        onAccept={handleAcceptTerms}
                        onPrev={() => setPendingTerms(null)}
                        submitError={applyError}
                    />
                )
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
                        spendableUsd={spendableUsd}
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
                return (
                    <ApplicationStatusScreen
                        variant="requires-support"
                        onContactSupport={() => setIsSupportModalOpen(true)}
                        onPrev={onBack}
                    />
                )
            case 'rejected': {
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
            case 'issued-celebration':
                return (
                    <CardMilestoneScreen
                        issued
                        onContinue={() => {
                            removeStoredValue(celebrationKey)
                            setShowIssuedCelebration(false)
                        }}
                    />
                )
            case 'active':
                return (
                    <YourCardScreen
                        overview={overview!}
                        card={activeCard!}
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
    }

    const screen = renderState()
    return (
        <PageContainer>
            <div className="flex min-h-inherit flex-col gap-6">
                {view.kind !== 'active' && stopBanner}
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
                source="card"
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

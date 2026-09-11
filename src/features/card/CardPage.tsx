'use client'
import { type FC } from 'react'
import { useTranslations } from 'next-intl'
import { findActiveCard } from '@/components/Card/cardState.utils'
import AddCardEntryScreen from '@/components/Card/AddCardEntryScreen'
import ApplicationStatusScreen from '@/components/Card/ApplicationStatusScreen'
import CardTermsScreen from '@/components/Card/CardTermsScreen'
import CardCountryConfirmScreen from '@/components/Card/CardCountryConfirmScreen'
import YourCardScreen from '@/components/Card/YourCardScreen'
import Loading from '@/components/Global/Loading'
import { Button } from '@/components/0_Bruddle/Button'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { initiateSelfHealResubmission } from '@/app/actions/sumsub'
import { useCardFlow } from './useCardFlow'

export const CardPage: FC = () => {
    const t = useTranslations('card')
    const tCommon = useTranslations('common')
    const {
        fetchUser,
        cardInfoError,
        refetchCardInfo,
        overview,
        overviewError,
        capabilitiesLoading,
        railsForProvider,
        state,
        applyError,
        setApplyError,
        pendingTerms,
        setPendingTerms,
        pendingCountryConfirmation,
        setPendingCountryConfirmation,
        isIssuing,
        geoBlocked,
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
        sumsubToken,
        handleSumsubComplete,
        handleSumsubClose,
        handleSumsubRefreshToken,
        setIsSupportModalOpen,
        onBack,
    } = useCardFlow()

    if (state === 'loading') {
        return (
            <PageContainer>
                <div className="flex min-h-inherit w-full items-center justify-center">
                    <Loading />
                </div>
            </PageContainer>
        )
    }

    if (cardInfoError || overviewError) {
        return (
            <PageContainer>
                <div className="flex min-h-inherit w-full flex-col items-center justify-center gap-4 p-4">
                    <p className="text-center text-foreground-primary">{t('page.loadFailed')}</p>
                    <Button onClick={() => refetchCardInfo()} variant="purple" shadowSize="4">
                        {tCommon('retry')}
                    </Button>
                </div>
            </PageContainer>
        )
    }

    const renderState = () => {
        // Highest priority: show the issuance spinner between "terms accepted"
        // and the overview refetch landing. Keeps the UX from flipping back
        // to Add Card for a split second while the API call is in flight.
        // `onPrev` is not optional here: this screen carries no other control,
        // so omitting it made a poll that ran long (or never resolved) read as
        // a frozen app — animations running, nothing tappable.
        if (isIssuing) {
            return <ApplicationStatusScreen variant="pending" onPrev={onBack} />
        }
        // Terminal regulatory block detected mid-funnel by the BE apply gate —
        // takes precedence over the confirmation/terms overlays (those flows
        // are moot once the country verdict is in).
        if (geoBlocked) {
            return <ApplicationStatusScreen variant="geo-blocked" onPrev={onBack} />
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
        if (pendingTerms) {
            return (
                <CardTermsScreen
                    isUsResident={pendingTerms.isUsResident}
                    onAccept={handleAcceptTerms}
                    onPrev={() => setPendingTerms(null)}
                    submitError={applyError}
                />
            )
        }
        switch (state) {
            case 'add-card':
                return <AddCardEntryScreen onApply={() => handleApply(false)} onPrev={onBack} applyError={applyError} />
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
                const cardRailReasonCode = poaSubmitted ? 'proof_of_address_review' : cardRail?.reason?.code
                const cardRailReason = poaSubmitted ? undefined : cardRail?.reason?.userMessage
                return (
                    <ApplicationStatusScreen
                        variant="requires-info"
                        reasonMessage={cardRailReason}
                        reasonCode={cardRailReasonCode}
                        onContactSupport={() => setIsSupportModalOpen(true)}
                        onUploadProofOfAddress={onUploadProofOfAddress}
                        onUploadIdentity={onUploadIdentity}
                        uploadError={poaError ?? identityUploadError ?? undefined}
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
                const cardRailReasonCode = poaSubmitted ? 'proof_of_address_review' : cardRail?.reason?.code
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
                const card = findActiveCard(overview)!
                return <YourCardScreen overview={overview!} card={card} onPrev={onBack} />
            }
            default:
                return null
        }
    }

    return (
        <PageContainer>
            {renderState()}
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
            <SumsubKycWrapper
                visible={sumsubToken !== null}
                accessToken={sumsubToken}
                onClose={handleSumsubClose}
                onComplete={handleSumsubComplete}
                onRefreshToken={handleSumsubRefreshToken}
            />
        </PageContainer>
    )
}

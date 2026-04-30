'use client'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isCapacitor } from '@/utils/capacitor'
import { chargePayUrl } from '@/utils/native-routes'
import { useQueryStates, parseAsStringEnum } from 'nuqs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { cardApi, type CardInfoResponse } from '@/services/card'
import { useAuth } from '@/context/authContext'
import { RAIN_CARD_OVERVIEW_QUERY_KEY, useRainCardOverview } from '@/hooks/useRainCardOverview'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { computeCardState, findActiveCard, type CardTopLevelState } from '@/components/Card/cardState.utils'
import CardPioneerFlow from '@/components/Card/CardPioneerFlow'
import AddCardEntryScreen from '@/components/Card/AddCardEntryScreen'
import ApplicationStatusScreen from '@/components/Card/ApplicationStatusScreen'
import CardTermsScreen from '@/components/Card/CardTermsScreen'
import YourCardScreen from '@/components/Card/YourCardScreen'
import Loading from '@/components/Global/Loading'
import { Button } from '@/components/0_Bruddle/Button'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { rainApi } from '@/services/rain'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'

const CardPage: FC = () => {
    const router = useRouter()
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const userId = user?.user?.userId

    const {
        data: cardInfo,
        isLoading: pioneerLoading,
        error: pioneerError,
        refetch: refetchCardInfo,
    } = useQuery<CardInfoResponse>({
        queryKey: ['card-info', userId],
        queryFn: () => cardApi.getInfo(),
        enabled: !!userId,
        staleTime: 30_000,
    })

    const { overview, isLoading: overviewLoading, error: overviewError } = useRainCardOverview()
    const { serializeGrant } = useGrantSessionKey()

    // Sumsub card-application token — populated when POST /rain/cards reports
    // the user still needs to complete the rain-card-application level.
    const [sumsubToken, setSumsubToken] = useState<string | null>(null)
    const [applyError, setApplyError] = useState<string | null>(null)
    // When backend returns status:'terms-required', we capture it here so
    // the dispatcher can render the terms screen between Sumsub and submit.
    const [pendingTerms, setPendingTerms] = useState<{ isUsResident: boolean } | null>(null)
    // Covers the moment between "terms accepted" and "overview refetched with
    // the new card row". Without it the screen would briefly flip back to Add
    // Card mid-apply before the state machine sees the new state.
    const [isIssuing, setIsIssuing] = useState(false)

    useEffect(() => {
        if (underMaintenanceConfig.disableCardPioneers) router.replace('/home')
    }, [router])

    const state = computeCardState({
        overview,
        pioneerInfo: cardInfo,
        overviewLoading,
        pioneerLoading,
    })

    // Fire CARD_STATE_VIEWED on each distinct top-level state entry. Skip the
    // initial 'loading' state — it would inflate the funnel without signal.
    const lastReportedStateRef = useRef<CardTopLevelState | null>(null)
    useEffect(() => {
        if (state === 'loading') return
        if (lastReportedStateRef.current === state) return
        posthog.capture(ANALYTICS_EVENTS.CARD_STATE_VIEWED, {
            state,
            previous_state: lastReportedStateRef.current,
        })
        lastReportedStateRef.current = state
    }, [state])

    const invalidateOverview = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
    }, [queryClient])

    const handleApply = useCallback(
        async (termsAccepted = false, serializedApproval?: string) => {
            setApplyError(null)
            posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_ATTEMPTED, {
                terms_accepted: termsAccepted,
                with_session_key: !!serializedApproval,
            })
            try {
                const res = await rainApi.applyForCard({ termsAccepted, serializedApproval })
                posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_SUCCEEDED, { outcome: res.status })
                if (res.status === 'incomplete' && 'sumsubAccessToken' in res) {
                    setSumsubToken(res.sumsubAccessToken)
                    posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_OPENED)
                    return
                }
                // Main applicant is missing a doc Rain requires (e.g. SELFIE
                // after liveness was added to the level). Open WebSDK at the
                // MAIN level — Sumsub asks only for the missing step. Same
                // wrapper handles both action and main-level tokens.
                if (res.status === 'main-kyc-required' && 'sumsubAccessToken' in res) {
                    setSumsubToken(res.sumsubAccessToken)
                    posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_OPENED)
                    return
                }
                if (res.status === 'terms-required' && 'isUsResident' in res) {
                    setPendingTerms({ isUsResident: res.isUsResident })
                    return
                }
                // pending / already-applied → state machine routes based on overview.
                setPendingTerms(null)
                invalidateOverview()
            } catch (e) {
                const message = e instanceof Error ? e.message : 'Failed to apply for card'
                console.error('[card apply] error:', e)
                setApplyError(message)
                posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_FAILED, { error_message: message })
            }
        },
        [invalidateOverview]
    )

    const handleAcceptTerms = useCallback(async () => {
        // If we already have the collateral contract (rail is ENABLED, re-issue
        // path), collect the session-key permission in the same passkey tap
        // before the backend creates the card. Fail closed: a cancelled /
        // failed tap means no card gets issued.
        const canGrant = !!overview?.status?.contractAddress && !!overview?.status?.coordinatorAddress
        posthog.capture(ANALYTICS_EVENTS.CARD_TERMS_ACCEPTED, {
            is_reissue: canGrant,
            is_us_resident: pendingTerms?.isUsResident ?? false,
        })

        if (!canGrant) {
            // First-time apply — no collateral proxy yet. Session-key grant
            // happens the next time the user lands here (re-issue path).
            setIsIssuing(true)
            try {
                await handleApply(true)
            } finally {
                setIsIssuing(false)
            }
            return
        }

        const isUsResidentSnapshot = pendingTerms?.isUsResident ?? false
        setIsIssuing(true)
        setApplyError(null)
        try {
            const tap = await serializeGrant()
            if (!tap.ok) {
                // Back to the terms screen with a friendly error. Don't hit
                // the backend — no card should be created without consent.
                setIsIssuing(false)
                setPendingTerms({ isUsResident: isUsResidentSnapshot })
                setApplyError(
                    tap.error.kind === 'user-cancelled'
                        ? 'Setup cancelled — please try again.'
                        : 'Could not complete setup — please try again.'
                )
                return
            }
            await handleApply(true, tap.serialized)
        } finally {
            setIsIssuing(false)
        }
    }, [handleApply, overview, pendingTerms, serializeGrant])

    // Distinguishes "user finished the applicant action" from "user closed the
    // modal without finishing" — without this both paths would fire
    // CARD_SUMSUB_CLOSED and inflate the abandonment number.
    const sumsubCompletedRef = useRef(false)

    const handleSumsubComplete = useCallback(async () => {
        sumsubCompletedRef.current = true
        posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_COMPLETED)
        setSumsubToken(null)
        // Re-submit now that the user finished the applicant action. Backend
        // will return terms-required next (since termsAccepted is still false).
        await handleApply(false)
    }, [handleApply])

    const handleSumsubClose = useCallback(() => {
        if (!sumsubCompletedRef.current) {
            posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_CLOSED)
        }
        sumsubCompletedRef.current = false
        setSumsubToken(null)
    }, [])

    const handleSumsubRefreshToken = useCallback(async () => {
        const res = await rainApi.applyForCard({ termsAccepted: false })
        if ((res.status === 'incomplete' || res.status === 'main-kyc-required') && 'sumsubAccessToken' in res) {
            return res.sumsubAccessToken
        }
        // Edge case: the user became "ready" between initial apply and the
        // refresh attempt. Close the modal and continue the non-Sumsub path.
        setSumsubToken(null)
        if (res.status === 'terms-required' && 'isUsResident' in res) {
            setPendingTerms({ isUsResident: res.isUsResident })
        } else {
            invalidateOverview()
        }
        return ''
    }, [invalidateOverview])

    if (underMaintenanceConfig.disableCardPioneers) return null

    if (state === 'loading') {
        return (
            <PageContainer>
                <div className="flex min-h-[inherit] w-full items-center justify-center">
                    <Loading />
                </div>
            </PageContainer>
        )
    }

    if (pioneerError || overviewError) {
        return (
            <PageContainer>
                <div className="flex min-h-[inherit] w-full flex-col items-center justify-center gap-4 p-4">
                    <p className="text-center text-n-1">Failed to load card info. Please try again.</p>
                    <Button onClick={() => refetchCardInfo()} variant="purple" shadowSize="4">
                        Retry
                    </Button>
                </div>
            </PageContainer>
        )
    }

    const renderState = () => {
        // Highest priority: show the issuance spinner between "terms accepted"
        // and the overview refetch landing. Keeps the UX from flipping back
        // to Add Card for a split second while the API call is in flight.
        if (isIssuing) {
            return <ApplicationStatusScreen variant="pending" />
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
            case 'pioneer':
                return <CardPioneerFlow cardInfo={cardInfo!} refetchCardInfo={refetchCardInfo} />
            case 'add-card':
                return (
                    <AddCardEntryScreen
                        onApply={() => handleApply(false)}
                        onPrev={() => router.back()}
                        applyError={applyError}
                    />
                )
            case 'pending':
                return <ApplicationStatusScreen variant="pending" onPrev={() => router.back()} />
            case 'manual-review':
                return <ApplicationStatusScreen variant="manual-review" onPrev={() => router.back()} />
            case 'rejected':
                // No retry CTA: Rain denials are terminal on our side. The only
                // path forward is support reviewing the case manually (PEP /
                // sanctions / fraud-pattern flags need a human in the loop on
                // Rain's end). The CTA is "Contact support" only.
                return (
                    <ApplicationStatusScreen
                        variant="rejected"
                        onContactSupport={() => router.push('/support')}
                        onPrev={() => router.back()}
                    />
                )
            case 'active': {
                const card = findActiveCard(overview)!
                return <YourCardScreen overview={overview!} card={card} onPrev={() => router.back()} />
            }
            default:
                return null
        }
    }

    return (
        <PageContainer>
            {renderState()}
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

export default CardPage

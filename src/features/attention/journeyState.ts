'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { formatUnits } from 'viem'
import { useAuth } from '@/context/authContext'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { QrKycState } from '@/constants/kyc.consts'
import { useActivationStatus } from '@/hooks/useActivationStatus'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useNotifications } from '@/hooks/useNotifications'
import { useProviderRejection } from '@/hooks/useProviderRejection'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { useWallet } from '@/hooks/wallet/useWallet'
import { selectQrKycGate } from '@/features/payments/flows/qr-pay/qrKycGate.utils'
import { verifyRowStatus } from '@/utils/activation-step.utils'
import { showVerifyCTA } from '@/utils/home-carousel.utils'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { POST_SIGNUP_ACTIONS } from '@/components/Global/PostSignupActionManager/post-signup-action.consts'
import { consentApi, type ConsentStatusResponse } from '@/services/consent'
import { LEGAL_DOCUMENT_VERSIONS } from '@/constants/legal-versions.generated'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { isSameRoute } from '@/constants/routes'
import { selectHomeTasks } from '@/utils/bridge-tasks.utils'
import { getStoredRedirect } from '@/utils/general.utils'
import { isCapacitor } from '@/utils/capacitor'
import type { RainCardOverview } from '@/services/rain'
import { useJourneyEpoch } from './journeyEpoch'
import type { JourneyState } from './types'

export const CONSENT_STATUS_QUERY_KEY = 'consent-status'

export type OutdatedDocument = { slug: string; currentVersion: string }

/** The documents that need acceptance and that this client can display. */
export function outdatedConsentDocuments(status: ConsentStatusResponse | undefined): OutdatedDocument[] | undefined {
    if (!status) return undefined
    if (!status.needsReConsent) return []
    // the wire shape is trusted nowhere else in render: a malformed response reads as nothing to accept
    if (!Array.isArray(status.documents)) return []
    return status.documents
        .filter(
            (d) => !!d && d.needsAcceptance === true && typeof d.slug === 'string' && d.slug in LEGAL_DOCUMENT_VERSIONS
        )
        .map((d) => ({ slug: d.slug, currentVersion: String(d.currentVersion) }))
}

export const outdatedConsentVersions = (status: ConsentStatusResponse | undefined): string[] | undefined =>
    outdatedConsentDocuments(status)?.map((d) => d.currentVersion)

export function cardNeedsSetup(overview: RainCardOverview | undefined): boolean {
    const card = findActiveCard(overview)
    return (
        card?.status === 'ACTIVE' &&
        !card.hasWithdrawApproval &&
        !!overview?.status?.contractAddress &&
        !!overview?.status?.coordinatorAddress
    )
}

export function hasPostSignupRedirect(destination: string | undefined): boolean {
    return !!destination && POST_SIGNUP_ACTIONS.some((action) => action.pathPattern.test(destination))
}

export interface JourneyInputs {
    now: number
    userId: string | null
    userLoaded: boolean
    isNative: boolean
    pathname: string | null
    consentDocuments: OutdatedDocument[] | undefined
    consentFailed: boolean
    identity: JourneyState['identity']
    onboarding: JourneyState['onboarding']
    blockedCardId: string | null
    dueTasks: number
    cardLoaded: boolean
    cardNeedsSetup: boolean
    activeCardId: string | null
    redirectDestination: string | undefined
    balanceUnits: bigint | undefined
    migrationOn: boolean
    pushReady: boolean
    pushUnanswered: boolean
    pushPromptedThisSession: boolean
    pushNotEnabled: boolean
    showEarlyUserModal: boolean | undefined
    activated: boolean
    geoCountry: string | null
    invitesSent: number
    hasSupportSurvivorBadge: boolean
    cardOffer: JourneyState['cardOffer']
    qr: JourneyState['qr']
    documentSlideKey: string | null
    userInterviewFlag: boolean
}

/** Pure, so a test (and later the API) can build the state without React. */
export function buildJourneyState(input: JourneyInputs): JourneyState {
    const documents = input.consentDocuments
    const consent: JourneyState['consent'] =
        documents === undefined
            ? // a failed status check must never hold the app: fail open, retry next session
              { status: input.consentFailed ? 'clear' : 'unknown', versions: [], documents: [] }
            : {
                  status: documents.length ? 'needed' : 'clear',
                  versions: documents.map((d) => d.currentVersion),
                  documents,
              }
    return {
        now: input.now,
        userId: input.userId,
        userLoaded: input.userLoaded,
        isNative: input.isNative,
        route: isSameRoute(input.pathname, '/home') ? 'home' : 'other',
        consent,
        identity: input.identity,
        onboarding: input.onboarding,
        blockedCardId: input.blockedCardId,
        dueTasks: input.dueTasks,
        card: { loaded: input.cardLoaded, needsSetup: input.cardNeedsSetup, activeCardId: input.activeCardId },
        postAuthRedirect: hasPostSignupRedirect(input.redirectDestination),
        postAuthRedirectDestination: hasPostSignupRedirect(input.redirectDestination)
            ? (input.redirectDestination ?? null)
            : null,
        balance: {
            loaded: input.balanceUnits !== undefined,
            usd:
                input.balanceUnits === undefined
                    ? 0
                    : Number(formatUnits(input.balanceUnits, PEANUT_WALLET_TOKEN_DECIMALS)),
        },
        migration: { on: input.migrationOn },
        push: {
            ready: input.pushReady,
            unanswered: input.pushUnanswered,
            promptedThisSession: input.pushPromptedThisSession,
            notEnabled: input.pushNotEnabled,
        },
        showEarlyUserModal: input.showEarlyUserModal,
        activated: input.activated,
        geoCountry: input.geoCountry,
        invitesSent: input.invitesSent,
        hasSupportSurvivorBadge: input.hasSupportSurvivorBadge,
        cardOffer: input.cardOffer,
        qr: input.qr,
        documentSlideKey: input.documentSlideKey,
        flags: { userInterview: input.userInterviewFlag },
    }
}

/**
 * Composes the hooks the app already has into one plain object the manager
 * reads. Almost everything is `/users/me` and its two embedded read-models;
 * consent status is the one extra request, once per session per user.
 */
export function useJourneyState(): JourneyState {
    const { user, isFetchingUser } = useAuth()
    const userId = user?.user.userId ?? null
    const pathname = usePathname()
    const { status, isVerified, needsAction, isTerminalFailure, isRegionRestricted } = useIdentityVerification()
    const { onboarding, isActivated, isLoading: onboardingLoading } = useActivationStatus()
    const { blockedCard } = useProviderRejection(onboarding)
    const { nextActions, rails, canDo, railsForProvider, channelOf, isLoading: capabilitiesLoading } = useCapabilities()
    const { overview, isLoading: overviewLoading } = useRainCardOverview()
    const { cardInfo, isEligible: isCardEligible, isLoading: cardInfoLoading, error: cardInfoError } = useCardInfo()
    const { balance } = useWallet()
    const migrationOn = useMigrationFlag()
    const { oneSignalInitialized, isPermissionGranted, isPermissionDenied, isPushOptedIn, promptShownThisSession } =
        useNotifications()
    const { countryCode: geoCountry } = useGeoLocation()
    const flagEnabled = useFeatureFlags()
    // shares the React Query cache key with HomeHistory, so this read is free while Home is mounted
    const { data: latestHistory } = useTransactionHistory({ mode: 'latest', limit: 50, enabled: !!userId })
    const epoch = useJourneyEpoch()

    const consent = useQuery({
        queryKey: [CONSENT_STATUS_QUERY_KEY, userId],
        queryFn: () => consentApi.getStatus(),
        enabled: !!userId,
        staleTime: Infinity,
        retry: 1,
    })

    const homeTasks = useMemo(() => selectHomeTasks(nextActions, rails ?? []), [nextActions, rails])
    const dueTasks = homeTasks.largeTasks.length
    const documentSlideKey = homeTasks.documentSlide?.key ?? null

    // the same gate the QR pay page reads, so the two never disagree
    const qr = useMemo<JourneyState['qr']>(() => {
        const gate = selectQrKycGate({
            isLoading: capabilitiesLoading || !user,
            isRegionRestricted,
            isTerminalFailure,
            canPayManteca: canDo('pay', { provider: 'manteca' }),
            mantecaRails: railsForProvider('manteca'),
            nextActions,
        })
        const railsInFlight = rails.some((rail) => rail.status === 'pending' || rail.status === 'requires-info')
        return {
            canPayNow: gate.kycGateState === QrKycState.PROCEED_TO_PAY,
            hasMadeQrPayment: latestHistory?.entries.some((entry) => entry.extraData?.kind === 'QR_PAY'),
            verifyOpensQr: showVerifyCTA({
                qrGateState: gate.kycGateState,
                isIdentityVerified: verifyRowStatus({ status: user ? status : undefined }) === 'done',
                isInFlight: railsInFlight,
                isCardEligible,
            }),
        }
    }, [
        capabilitiesLoading,
        user,
        isRegionRestricted,
        isTerminalFailure,
        canDo,
        railsForProvider,
        nextActions,
        rails,
        latestHistory,
        status,
        isCardEligible,
    ])

    const cardOffer = useMemo<JourneyState['cardOffer']>(
        () => ({
            // a failed request (retries spent) settles as loaded: no card offer, instead of a placeholder that never resolves
            loaded: !cardInfoLoading && (cardInfo !== undefined || !!cardInfoError),
            geoProhibited: !!cardInfo?.geoProhibited,
            hasCardRelationship: rails.some((rail) => channelOf(rail) === 'card'),
            promotionDisabled: underMaintenanceConfig.disableCardPromotion,
        }),
        [cardInfoLoading, cardInfo, cardInfoError, rails, channelOf]
    )

    return useMemo(
        () =>
            buildJourneyState({
                // the epoch stands for the localStorage reads below (stored redirect)
                now: Date.now() + epoch * 0,
                userId,
                userLoaded: !!user && !isFetchingUser,
                isNative: isCapacitor(),
                pathname,
                consentDocuments: outdatedConsentDocuments(consent.data),
                consentFailed: consent.isError,
                identity: {
                    status: user ? status : undefined,
                    isVerified,
                    needsAction,
                    isTerminalFailure,
                    isRegionRestricted,
                },
                onboarding: onboardingLoading ? null : onboarding,
                blockedCardId: blockedCard?.ctaId ?? null,
                dueTasks,
                cardLoaded: !overviewLoading,
                cardNeedsSetup: cardNeedsSetup(overview),
                activeCardId: findActiveCard(overview)?.id ?? null,
                redirectDestination: getStoredRedirect()?.destination,
                balanceUnits: balance,
                migrationOn,
                pushReady: oneSignalInitialized,
                pushUnanswered: !isPermissionGranted && !isPermissionDenied && !isPushOptedIn,
                pushPromptedThisSession: promptShownThisSession,
                pushNotEnabled: !isPermissionGranted && !isPushOptedIn,
                showEarlyUserModal: user?.showEarlyUserModal,
                activated: isActivated,
                geoCountry,
                invitesSent: user?.invitesSent?.length ?? 0,
                hasSupportSurvivorBadge:
                    user?.user?.badges?.some((badge) => badge.code === 'SUPPORT_SURVIVOR') ?? false,
                cardOffer,
                qr,
                documentSlideKey,
                // nonProdBypass: previews and local always show the card for QA; on prod the PostHog cohort decides
                userInterviewFlag: flagEnabled('user-interviews-invite', { nonProdBypass: true }),
            }),
        [
            userId,
            user,
            isFetchingUser,
            pathname,
            consent.data,
            consent.isError,
            status,
            isVerified,
            needsAction,
            isTerminalFailure,
            isRegionRestricted,
            onboarding,
            onboardingLoading,
            blockedCard?.ctaId,
            dueTasks,
            overview,
            overviewLoading,
            balance,
            migrationOn,
            oneSignalInitialized,
            isPermissionGranted,
            isPermissionDenied,
            isPushOptedIn,
            promptShownThisSession,
            isActivated,
            geoCountry,
            cardOffer,
            qr,
            documentSlideKey,
            flagEnabled,
            epoch,
        ]
    )
}

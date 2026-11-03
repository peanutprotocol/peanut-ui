'use client'

import { useCardSurfaceAccess } from '@/hooks/useCardSurfaceAccess'
import { CARD_PROMOTION_DISABLED_FLAG } from '@/constants/card-flags.consts'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { formatUnits } from 'viem'
import { useAuth } from '@/context/authContext'
import { useKillSwitches } from '@/features/kill-switches/useKillSwitches'
import { QrKycState } from '@/constants/kyc.consts'
import { useActivationStatus } from '@/hooks/useActivationStatus'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useCardFundingAccess } from '@/hooks/useCardFundingAccess'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { useArrivalPrompt } from '@/features/home/useArrivalPrompt'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useNotifications } from '@/hooks/useNotifications'
import { useProviderRejection } from '@/hooks/useProviderRejection'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { DEPOSIT_ACCOUNTS_QUERY_KEY } from '@/features/deposit-accounts/useDepositAccounts'
import { fetchDepositAccounts, type DepositAccountsSnapshot } from '@/services/deposit-accounts'
import type {
    ClaimableCorridor,
    DepositAccount,
    DepositAccountView,
    UnavailableCorridor,
} from '@/features/deposit-accounts/types'
import { corridorFromRailId, emptyCorridorRecord } from '@/features/deposit-accounts/rails'
import { closeRefusedCorridors } from '@/features/deposit-accounts/reportClosures'
import type { FeatureReport, RailCapability } from '@/types/capabilities'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { pointsApi } from '@/services/points'
import type { HistoryEntry } from '@/utils/history.utils'
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
import { getStoredRedirect, getUserPreferences } from '@/utils/general.utils'
import { visibleHomeTasks } from './taskVisibility'
import { selectMantecaCapNudge } from '@/utils/capability-gate'
import { isDemoMode } from '@/utils/demo'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { detectDeviceType } from '@/hooks/useGetDeviceType'
import { selectMaintenance } from './maintenance'
import { isCapacitor } from '@/utils/capacitor'
import { rainApi, type RainCardFunding, type RainCardOverview } from '@/services/rain'
import { RAIN_CARD_FUNDING_QUERY_KEY } from '@/hooks/useCardStopConfirmation'
import { cardFundingState, cardSetupPath, useFundingPromptHold } from './cardFunding'
import { fact } from './faults'
import { useJourneyEpoch } from './journeyEpoch'
import type { JourneyState } from './types'
import { applyServerFacts, useServerAttention } from './serverAttention'

export const CONSENT_STATUS_QUERY_KEY = 'consent-status'

export function useAttentionDepositAccounts(userId: string | null, enabled: boolean) {
    return useQuery({
        queryKey: [...DEPOSIT_ACCOUNTS_QUERY_KEY, userId],
        queryFn: fetchDepositAccounts,
        enabled: !!userId && enabled,
        refetchInterval: false,
    })
}

export function depositAccountCounts(
    data: DepositAccountsSnapshot | undefined,
    report?: FeatureReport,
    rails: readonly RailCapability[] = []
): { claimable: number; active: number } {
    const accounts = new Map<string, DepositAccount>()
    for (const account of data?.accounts ?? []) {
        const corridor = corridorFromRailId(account.railId)
        if (!corridor) continue
        const current = accounts.get(corridor)
        if (
            !current ||
            (account.isPrimary !== current.isPrimary
                ? account.isPrimary
                : current.status === 'retiring' && account.status !== 'retiring')
        )
            accounts.set(corridor, account)
    }
    const held = emptyCorridorRecord<DepositAccountView>()
    for (const [corridor, account] of accounts) held[corridor as keyof typeof held] = account
    const offered = emptyCorridorRecord<ClaimableCorridor>()
    for (const entry of data?.claimable ?? []) {
        const corridor = corridorFromRailId(entry.railId)
        if (corridor) offered[corridor] = entry
    }
    const unavailable = emptyCorridorRecord<UnavailableCorridor>()
    for (const entry of data?.unavailable ?? []) {
        const corridor = corridorFromRailId(entry.railId)
        if (corridor) unavailable[corridor] = entry
    }
    const closed = closeRefusedCorridors(report, rails, { accounts: held, claimable: offered, unavailable })
    return {
        claimable: Object.values(closed.claimable).filter(Boolean).length,
        active: [...accounts.values()].filter((a) => a.status === 'active').length,
    }
}

export function cardOfferFacts(input: {
    loading: boolean
    cardInfo: unknown
    error: unknown
    showCardSurface: boolean
    hasCardRelationship: boolean
    promotionDisabled: boolean
    canSpendViaCard?: boolean
}): JourneyState['cardOffer'] {
    return {
        loaded: !input.loading && (input.cardInfo !== undefined || !!input.error),
        geoProhibited: !input.showCardSurface || input.cardInfo === undefined,
        hasCardRelationship: input.hasCardRelationship,
        promotionDisabled: input.promotionDisabled,
        canSpendViaCard: input.canSpendViaCard === true,
    }
}

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

/** What the latest history page says about spending and requests; undefined while it loads. */
export function summarizeHistory(entries: HistoryEntry[] | undefined): {
    lastSpendAt: string | null
    hasReceivedRequestPayment: boolean | undefined
} {
    if (!entries) return { lastSpendAt: null, hasReceivedRequestPayment: undefined }
    let last: number | null = null
    for (const entry of entries) {
        const kind = entry.extraData?.kind
        if (kind !== 'QR_PAY' && kind !== 'CARD_SPEND') continue
        const at = new Date(entry.timestamp).getTime()
        if (Number.isFinite(at) && (last === null || at > last)) last = at
    }
    return {
        lastSpendAt: last === null ? null : new Date(last).toISOString(),
        hasReceivedRequestPayment: entries.some(
            (entry) => entry.extraData?.kind === 'REQUEST_PAY' && entry.userRole === 'RECIPIENT'
        ),
    }
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
    capNudge: JourneyState['capNudge']
    maintenance: JourneyState['maintenance']
    now: number
    userId: string | null
    userLoaded: boolean
    isNative: boolean
    deviceType: JourneyState['deviceType']
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
    cardSetupPath: JourneyState['card']['setupPath']
    cardNeedsFunding: JourneyState['card']['needsFunding']
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
    depositAccounts: JourneyState['depositAccounts']
    history: HistoryEntry[] | undefined
    firstPeerPaymentAt: string | null
    passkeyCount: number | null
    hasEmail: boolean
    hasFullName: boolean
    rewardsPendingUsd: number | undefined
    serverLedger: unknown
    arrival: JourneyState['arrival']
}

/** Pure, so a test (and later the API) can build the state without React. */
export function buildJourneyState(input: JourneyInputs): JourneyState {
    const documents = input.consentDocuments
    const units = input.balanceUnits
    const consent: JourneyState['consent'] =
        documents === undefined
            ? // The settle deadline releases lower prompts; a failed read never proves consent is clear.
              { status: 'unknown', versions: [], documents: [] }
            : {
                  status: documents.length ? 'needed' : 'clear',
                  versions: documents.map((d) => d.currentVersion),
                  documents,
              }
    return {
        capNudge: input.capNudge,
        maintenance: input.maintenance,
        now: input.now,
        userId: input.userId,
        userLoaded: input.userLoaded,
        isNative: input.isNative,
        deviceType: input.deviceType,
        route: isSameRoute(input.pathname, '/home') ? 'home' : 'other',
        consent,
        identity: input.identity,
        onboarding: input.onboarding,
        blockedCardId: input.blockedCardId,
        dueTasks: input.dueTasks,
        card: {
            loaded: input.cardLoaded,
            needsSetup: input.cardNeedsSetup,
            activeCardId: input.activeCardId,
            setupPath: input.cardSetupPath,
            needsFunding: input.cardNeedsFunding,
        },
        postAuthRedirect: hasPostSignupRedirect(input.redirectDestination),
        postAuthRedirectDestination: hasPostSignupRedirect(input.redirectDestination)
            ? (input.redirectDestination ?? null)
            : null,
        balance: {
            loaded: units !== undefined,
            usd:
                units === undefined
                    ? 0
                    : fact('balance', () => Number(formatUnits(units, PEANUT_WALLET_TOKEN_DECIMALS)), 0),
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
        depositAccounts: input.depositAccounts,
        ...fact('history', () => summarizeHistory(input.history), {
            lastSpendAt: null,
            hasReceivedRequestPayment: undefined,
        }),
        firstPeerPaymentAt: input.firstPeerPaymentAt,
        passkeyCount: input.passkeyCount,
        hasEmail: input.hasEmail,
        hasFullName: input.hasFullName,
        rewardsPendingUsd: input.rewardsPendingUsd,
        serverLedger: input.serverLedger,
        arrival: input.arrival,
    }
}

/**
 * Composes the hooks the app already has into one plain object the manager
 * reads. Almost everything is `/users/me` and its two embedded read-models;
 * consent status is the one extra request, once per session per user. Off
 * Home only the terms prompt, banners and inline notices can show, so the data
 * only Home's asks read (card funding, history, deposit accounts, rewards, the
 * IP country) is fetched on Home only.
 */
export function useJourneyState(): JourneyState {
    const { user, isFetchingUser } = useAuth()
    const userId = user?.user.userId ?? null
    const pathname = usePathname()
    const isHomeRoute = isSameRoute(pathname, '/home')
    const onHome = isHomeRoute || isSameRoute(pathname, '/dev/attention')
    const { status, isVerified, needsAction, isTerminalFailure, isRegionRestricted } = useIdentityVerification()
    const { onboarding, isActivated, isLoading: onboardingLoading } = useActivationStatus()
    const { blockedCard } = useProviderRejection(onboarding)
    const {
        capabilities,
        nextActions,
        rails,
        canDo,
        railsForProvider,
        channelOf,
        isLoading: capabilitiesLoading,
    } = useCapabilities()
    const serverAttention = useServerAttention()
    const { overview, isLoading: overviewLoading } = useRainCardOverview()
    const activeCard = fact('activeCard', () => findActiveCard(overview), null)
    const hasActiveCard = activeCard?.status === 'ACTIVE'
    const fundingAccess = useCardFundingAccess({ enabled: hasActiveCard && onHome })
    const fundingInputs = { hasActiveCard, accessLoading: fundingAccess.isLoading, access: fundingAccess.access }
    // same key and request as useRainFunding, so FundingSetupPrompt and the verdict read one answer
    const fundingUserId = user?.user?.userId
    const cardFunding = useQuery<RainCardFunding>({
        queryKey: [RAIN_CARD_FUNDING_QUERY_KEY, fundingUserId],
        queryFn: () => rainApi.getCardFunding(),
        enabled:
            onHome &&
            fact('cardSetupPath', () => cardSetupPath(fundingInputs), 'none') === 'managed' &&
            !!fundingUserId,
        staleTime: 30_000,
        retry: false,
    })
    const fundingHold = useFundingPromptHold(activeCard?.id ?? null)
    const { setupPath, needsFunding } = fact<ReturnType<typeof cardFundingState>>(
        'cardFunding',
        () =>
            cardFundingState({
                ...fundingInputs,
                fundingLoading: cardFunding.isLoading,
                funding: cardFunding.isError ? undefined : cardFunding.data,
                overview,
                hold: fundingHold,
            }),
        { setupPath: 'none', needsFunding: false }
    )
    const { cardInfo, isEligible: isCardEligible, isLoading: cardInfoLoading, error: cardInfoError } = useCardInfo()
    const { balance } = useWallet()
    const migrationOn = useMigrationFlag()
    const {
        oneSignalInitialized,
        isPermissionGranted,
        isPermissionDenied,
        isPushOptedIn,
        contextualPromptShownThisSession: promptShownThisSession,
    } = useNotifications()
    const { countryCode: geoCountry } = useGeoLocation({ enabled: isHomeRoute })
    const { arrival, checked: arrivalChecked } = useArrivalPrompt(isHomeRoute)
    const killSwitches = useKillSwitches()
    const flagEnabled = useFeatureFlags()
    const cardPromotionDisabled = flagEnabled(CARD_PROMOTION_DISABLED_FLAG)
    // shares the React Query cache key with HomeHistory, so this read is free while Home is mounted
    const { data: latestHistory } = useTransactionHistory({ mode: 'latest', limit: 50, enabled: !!userId && onHome })
    const epoch = useJourneyEpoch()
    const depositAccountsEnabled = useDepositAccountsEnabled()
    const deposit = useAttentionDepositAccounts(userId, depositAccountsEnabled && onHome)
    // same key as useRewardsFlow, so Rewards and the card read one answer
    const cashStatus = useQuery({
        queryKey: ['cashStatus', userId],
        queryFn: () => pointsApi.getCashStatus(),
        enabled: !!userId && isActivated && onHome,
        staleTime: 60_000,
        retry: 1,
    })
    const depositAccounts = useMemo<JourneyState['depositAccounts']>(
        () => ({
            enabled: depositAccountsEnabled,
            // a failed query settles as nothing to claim rather than a card that never resolves
            loaded: !deposit.isLoading,
            ...fact('depositAccounts', () => depositAccountCounts(deposit.data, capabilities.features, rails), {
                claimable: 0,
                active: 0,
            }),
        }),
        [depositAccountsEnabled, deposit.isLoading, deposit.data, capabilities.features, rails]
    )

    const consent = useQuery({
        queryKey: [CONSENT_STATUS_QUERY_KEY, userId],
        queryFn: () => consentApi.getStatus(),
        enabled: !!userId,
        staleTime: Infinity,
        retry: 1,
    })

    const homeTasks = useMemo(
        () =>
            fact<ReturnType<typeof selectHomeTasks>>(
                'homeTasks',
                () => selectHomeTasks(nextActions, capabilities.features),
                {
                    largeTasks: [],
                    documentSlide: undefined,
                }
            ),
        [nextActions, capabilities.features]
    )
    const dueTasks = fact(
        'dueTasks',
        () =>
            visibleHomeTasks(
                homeTasks.largeTasks,
                userId ? getUserPreferences(userId)?.pendingVerificationTasksDismissed : []
            ).length,
        0
    )
    const documentSlideKey = homeTasks.documentSlide?.key ?? null

    // the same gate the QR pay page reads, so the two never disagree
    const qr = useMemo<JourneyState['qr']>(
        () =>
            fact<JourneyState['qr']>(
                'qr',
                () => {
                    const gate = selectQrKycGate({
                        isLoading: capabilitiesLoading || !user,
                        isRegionRestricted,
                        isTerminalFailure,
                        canPayManteca: canDo('pay', { provider: 'manteca' }),
                        mantecaRails: railsForProvider('manteca'),
                        nextActions,
                    })
                    const railsInFlight = rails.some(
                        (rail) => rail.status === 'pending' || rail.status === 'requires-info'
                    )
                    return {
                        canPayNow: gate.kycGateState === QrKycState.PROCEED_TO_PAY,
                        hasMadeQrPayment: latestHistory?.entries.some((entry) => entry.extraData?.kind === 'QR_PAY')
                            ? true
                            : undefined,
                        verifyOpensQr: showVerifyCTA({
                            qrGateState: gate.kycGateState,
                            isIdentityVerified: verifyRowStatus({ status: user ? status : undefined }) === 'done',
                            isInFlight: railsInFlight,
                            isCardEligible,
                        }),
                    }
                },
                { canPayNow: false, hasMadeQrPayment: false, verifyOpensQr: false }
            ),
        [
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
        ]
    )

    // the offer follows the nav's card gate (TASK-23017): a card-restricted residence hides it too
    const { showCardSurface, canSpendPathViaCard } = useCardSurfaceAccess()
    const cardOffer = useMemo<JourneyState['cardOffer']>(
        () =>
            fact<JourneyState['cardOffer']>(
                'cardOffer',
                () =>
                    cardOfferFacts({
                        loading: cardInfoLoading,
                        cardInfo,
                        error: cardInfoError,
                        showCardSurface,
                        hasCardRelationship: rails.some((rail) => channelOf(rail) === 'card'),
                        promotionDisabled: cardPromotionDisabled,
                        canSpendViaCard: canSpendPathViaCard,
                    }),
                {
                    loaded: true,
                    geoProhibited: true,
                    hasCardRelationship: false,
                    promotionDisabled: true,
                    canSpendViaCard: false,
                }
            ),
        [
            cardInfoLoading,
            cardInfo,
            cardInfoError,
            showCardSurface,
            rails,
            channelOf,
            cardPromotionDisabled,
            canSpendPathViaCard,
        ]
    )

    const capNudge = useMemo(
        () =>
            capabilitiesLoading
                ? undefined
                : fact('capNudge', () => selectMantecaCapNudge(rails, nextActions) ?? null, null),
        [capabilitiesLoading, rails, nextActions]
    )
    const demoMode = useHydrationSnapshot(isDemoMode, () => false)
    const deviceType = useHydrationSnapshot<JourneyState['deviceType']>(detectDeviceType, () => null)
    const maintenance = fact<JourneyState['maintenance']>(
        'maintenance',
        () => selectMaintenance({ pathname, config: killSwitches, demo: demoMode }),
        'none'
    )

    return useMemo(
        () =>
            applyServerFacts(
                buildJourneyState({
                    capNudge,
                    maintenance,
                    // the epoch stands for the localStorage reads below (stored redirect)
                    now: Date.now() + epoch * 0,
                    userId,
                    userLoaded: !!user && !isFetchingUser,
                    isNative: isCapacitor(),
                    deviceType,
                    pathname,
                    consentDocuments: fact('consent', () => outdatedConsentDocuments(consent.data), undefined),
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
                    cardNeedsSetup: fact('cardNeedsSetup', () => cardNeedsSetup(overview), false),
                    activeCardId: fact('activeCard', () => findActiveCard(overview)?.id ?? null, null),
                    cardSetupPath: setupPath,
                    cardNeedsFunding: needsFunding,
                    redirectDestination: fact('storedRedirect', () => getStoredRedirect()?.destination, undefined),
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
                    hasSupportSurvivorBadge: fact(
                        'badges',
                        () => user?.user?.badges?.some((badge) => badge.code === 'SUPPORT_SURVIVOR') ?? false,
                        false
                    ),
                    cardOffer,
                    qr,
                    documentSlideKey,
                    // nonProdBypass: previews and local always show the card for QA; on prod the PostHog cohort decides
                    userInterviewFlag: flagEnabled('user-interviews-invite', { nonProdBypass: true }),
                    depositAccounts,
                    history: latestHistory?.entries,
                    firstPeerPaymentAt: user?.user?.firstPaymentAt ?? null,
                    passkeyCount: user?.passkeyCount ?? null,
                    hasEmail: !!user?.user?.email,
                    hasFullName: !!user?.user?.fullName,
                    // a failed request is no card, not a card held forever
                    rewardsPendingUsd: cashStatus.isError ? 0 : cashStatus.data?.data?.rewards?.pendingUsd,
                    serverLedger: user?.attention,
                    arrival: !arrivalChecked ? 'unknown' : arrival ? 'raised' : 'none',
                }),
                serverAttention
            ),
        [
            serverAttention,
            capNudge,
            maintenance,
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
            setupPath,
            needsFunding,
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
            depositAccounts,
            latestHistory,
            cashStatus.isError,
            cashStatus.data,
            arrival,
            arrivalChecked,
            epoch,
        ]
    )
}

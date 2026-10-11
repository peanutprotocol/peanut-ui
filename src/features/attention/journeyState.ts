'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { formatUnits } from 'viem'
import { useAuth } from '@/context/authContext'
import { useActivationStatus } from '@/hooks/useActivationStatus'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useNotifications } from '@/hooks/useNotifications'
import { useProviderRejection } from '@/hooks/useProviderRejection'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useWallet } from '@/hooks/wallet/useWallet'
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
import type { JourneyState } from './types'

export const CONSENT_STATUS_QUERY_KEY = 'consent-status'

/** The documents that need acceptance and that this client can display. */
export function outdatedConsentVersions(status: ConsentStatusResponse | undefined): string[] | undefined {
    if (!status) return undefined
    if (!status.needsReConsent) return []
    return status.documents
        .filter((d) => d.needsAcceptance && d.slug in LEGAL_DOCUMENT_VERSIONS)
        .map((d) => d.currentVersion)
}

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
    consentVersions: string[] | undefined
    consentFailed: boolean
    identity: JourneyState['identity']
    onboarding: JourneyState['onboarding']
    blockedCardId: string | null
    dueTasks: number
    cardLoaded: boolean
    cardNeedsSetup: boolean
    redirectDestination: string | undefined
    balanceUnits: bigint | undefined
    migrationOn: boolean
    pushReady: boolean
    pushUnanswered: boolean
    showEarlyUserModal: boolean | undefined
}

/** Pure, so a test (and later the API) can build the state without React. */
export function buildJourneyState(input: JourneyInputs): JourneyState {
    const consent: JourneyState['consent'] =
        input.consentVersions === undefined
            ? // a failed status check must never hold the app: fail open, retry next session
              { status: input.consentFailed ? 'clear' : 'unknown', versions: [] }
            : { status: input.consentVersions.length ? 'needed' : 'clear', versions: input.consentVersions }
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
        card: { loaded: input.cardLoaded, needsSetup: input.cardNeedsSetup },
        postAuthRedirect: hasPostSignupRedirect(input.redirectDestination),
        balance: {
            loaded: input.balanceUnits !== undefined,
            usd:
                input.balanceUnits === undefined
                    ? 0
                    : Number(formatUnits(input.balanceUnits, PEANUT_WALLET_TOKEN_DECIMALS)),
        },
        migration: { on: input.migrationOn },
        push: { ready: input.pushReady, unanswered: input.pushUnanswered },
        showEarlyUserModal: input.showEarlyUserModal,
    }
}

/**
 * Composes the hooks the app already has into one plain object the arbiter
 * reads. Almost everything is `/users/me` and its two embedded read-models;
 * consent status is the one extra request, once per session per user.
 */
export function useJourneyState(): JourneyState {
    const { user, isFetchingUser } = useAuth()
    const userId = user?.user.userId ?? null
    const pathname = usePathname()
    const { status, isVerified, needsAction, isTerminalFailure, isRegionRestricted } = useIdentityVerification()
    const { onboarding, isLoading: onboardingLoading } = useActivationStatus()
    const { blockedCard } = useProviderRejection(onboarding)
    const { nextActions, rails } = useCapabilities()
    const { overview, isLoading: overviewLoading } = useRainCardOverview()
    const { balance } = useWallet()
    const migrationOn = useMigrationFlag()
    const { oneSignalInitialized, isPermissionGranted, isPermissionDenied, isPushOptedIn } = useNotifications()

    const consent = useQuery({
        queryKey: [CONSENT_STATUS_QUERY_KEY, userId],
        queryFn: () => consentApi.getStatus(),
        enabled: !!userId,
        staleTime: Infinity,
        retry: 1,
    })

    const dueTasks = useMemo(() => selectHomeTasks(nextActions, rails ?? []).largeTasks.length, [nextActions, rails])

    return useMemo(
        () =>
            buildJourneyState({
                now: Date.now(),
                userId,
                userLoaded: !!user && !isFetchingUser,
                isNative: isCapacitor(),
                pathname,
                consentVersions: outdatedConsentVersions(consent.data),
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
                redirectDestination: getStoredRedirect()?.destination,
                balanceUnits: balance,
                migrationOn,
                pushReady: oneSignalInitialized,
                pushUnanswered: !isPermissionGranted && !isPermissionDenied && !isPushOptedIn,
                showEarlyUserModal: user?.showEarlyUserModal,
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
        ]
    )
}

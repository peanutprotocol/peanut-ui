import { buildSupportVerificationSummary } from '@/utils/support-verification'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces/interfaces'
import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
    ARBISCAN_ADDRESS_BASE_URL,
    POSTHOG_PERSON_BASE_URL,
    BRIDGE_DASHBOARD_BASE_URL,
    SENTRY_USER_ISSUES_BASE_URL,
} from '@/constants/support'
import {
    readCachedLimits,
    readCachedRainOverview,
    readCachedSmartBalance,
    readLatestHistoryEntry,
} from '@/utils/support-cache'
import {
    buildAccountStats,
    buildBalanceSummary,
    buildCardSummary,
    buildLatestActivity,
    buildLimitsSummary,
    buildLinkedAccounts,
    buildSupportSegments,
} from '@/utils/support-context'
import { isRainBalanceKnown } from '@/utils/balance.utils'
import { useSupportClientContext } from '@/hooks/useSupportClientContext'

export interface CrispUserData {
    username: string | undefined
    userId: string | undefined
    email: string | undefined
    fullName: string | undefined
    avatar: string | undefined
    walletAddress: string | undefined
    walletAddressLink: string | undefined
    bridgeCustomerLink: string | undefined
    mantecaUserId: string | undefined
    posthogPersonLink: string | undefined
    sentryIssuesLink: string | undefined
    // Live verification state so agents stop guessing where a user is stuck (#2360).
    identityStatus: string | undefined
    emailOnFile: boolean | undefined
    verificationGates: string | undefined
    verificationRails: string | undefined
    failureReason: string | undefined
    pendingActions: string | undefined
    // Account context — balance, points, activity, limits, card, device/build.
    balance: string | undefined
    accountStats: string | undefined
    latestActivity: string | undefined
    limitsRemaining: string | undefined
    card: string | undefined
    linkedAccounts: string | undefined
    appContext: string | undefined
    /** Filterable/routable flags for the Crisp inbox — not sidebar rows. */
    segments: string[]
}

/**
 * Prepares user data for Crisp chat integration
 * Extracts user information from auth context and formats it for Crisp
 *
 * Everything here is data the client already holds — the /get-user read-models
 * plus warm react-query caches. Crisp gets no database access; this hook only
 * forwards what the app itself already knows, so a support agent stops opening
 * with "what's your balance / what did you last do / which build are you on".
 *
 * ⚠️ NEVER subscribe to a query here. SupportDrawer mounts this app-wide (for
 * guests too), so a `useWallet()` / `useLimits()` / `useRainCardOverview()` call
 * in this hook would start a poll for every user on every screen. Reads go
 * through `support-cache`, which only ever looks at what is already cached.
 */
export function useCrispUserData(): CrispUserData {
    const { username, userId, user } = useAuth()
    const queryClient = useQueryClient()
    const client = useSupportClientContext()

    const walletAddress =
        user?.accounts?.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier || undefined

    const smartBalance = readCachedSmartBalance(queryClient, walletAddress)
    const rainOverview = readCachedRainOverview(queryClient, userId)
    const limits = readCachedLimits(queryClient)
    const latestEntry = readLatestHistoryEntry(queryClient)

    const snapshot = buildCrispUserData({
        username,
        userId,
        user,
        walletAddress,
        smartBalance,
        rainOverview,
        limits,
        latestEntry,
        client,
    })

    /*
     * Identity is keyed on the serialized value, not on the inputs: the cache
     * reads above return a fresh object every render, and the consumer pushes to
     * Crisp on every identity change. Memoizing on the signature means a push
     * happens when a *value* changes and not merely when React re-rendered.
     */
    const signature = JSON.stringify(snapshot)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` IS the dependency; see above
    return useMemo(() => snapshot, [signature])
}

type CrispUserDataInput = {
    username: string | undefined
    userId: string | undefined
    user: ReturnType<typeof useAuth>['user']
    walletAddress: string | undefined
    smartBalance: bigint | undefined
    rainOverview: ReturnType<typeof readCachedRainOverview>
    limits: ReturnType<typeof readCachedLimits>
    latestEntry: ReturnType<typeof readLatestHistoryEntry>
    client: ReturnType<typeof useSupportClientContext>
}

function buildCrispUserData(input: CrispUserDataInput): CrispUserData {
    const { username, userId, user, walletAddress, smartBalance, rainOverview, limits, latestEntry, client } = input

    // Use address from user.accounts (database) rather than useWallet hook
    // This ensures we always show the user's wallet address in support metadata,
    // even if ZeroDev client isn't initialized yet. useWallet().address could be
    // undefined during initialization, but we want persistent data for support agents.
    const walletAddressLink = walletAddress ? `${ARBISCAN_ADDRESS_BASE_URL}/${walletAddress}` : undefined

    const bridgeCustomerId = user?.user?.bridgeCustomerId || undefined
    const bridgeCustomerLink = bridgeCustomerId ? `${BRIDGE_DASHBOARD_BASE_URL}/${bridgeCustomerId}` : undefined
    // DATA GAP (flagged): the Manteca providerUserId used to come from the now-removed
    // raw `user.kycVerifications` field. Neither read-model carries it — `capabilities`
    // is provider-blind, `identityVerification` has no provider metadata. This was only
    // an internal support-dashboard convenience link (not user-facing, not a gate), so
    // it degrades to undefined until the backend exposes a provider-account id. Do NOT
    // fabricate it from capabilities.
    const mantecaUserId = undefined

    const posthogPersonLink = userId ? `${POSTHOG_PERSON_BASE_URL}/${userId}` : undefined
    const sentryIssuesLink = userId ? `${SENTRY_USER_ISSUES_BASE_URL}:${userId}` : undefined

    const email = user?.user?.email || undefined
    const verification = user
        ? buildSupportVerificationSummary(user.capabilities, user.identityVerification, email)
        : undefined

    const balance = user ? buildBalanceSummary(smartBalance, rainOverview) : undefined
    const balanceKnown = smartBalance !== undefined && isRainBalanceKnown(rainOverview)

    const appContext = [
        client.platform,
        client.appBuild,
        `locale:${client.locale}`,
        client.routeOnOpen ? `route:${client.routeOnOpen}` : undefined,
        client.isOffline ? 'offline' : client.isApiUnreachable ? 'api-unreachable' : 'online',
        `notif:${client.notificationPermission}`,
    ]
        .filter(Boolean)
        .join(' · ')

    return {
        username,
        userId,
        email,
        fullName: user?.user?.fullName,
        avatar: user?.user?.profile_picture || undefined,
        walletAddress,
        walletAddressLink,
        bridgeCustomerLink,
        mantecaUserId,
        posthogPersonLink,
        sentryIssuesLink,
        identityStatus: verification?.identityStatus,
        emailOnFile: verification?.emailOnFile,
        verificationGates: verification?.gates,
        verificationRails: verification?.verificationRails,
        failureReason: verification?.failureReason,
        pendingActions: verification?.pendingActions,
        balance,
        accountStats: buildAccountStats(user ?? undefined),
        latestActivity: buildLatestActivity(latestEntry),
        limitsRemaining: buildLimitsSummary(limits),
        card: buildCardSummary(rainOverview),
        linkedAccounts: buildLinkedAccounts(user?.accounts),
        appContext,
        segments: buildSupportSegments({
            isLoggedIn: Boolean(userId),
            platform: client.platform,
            identityStatus: verification?.identityStatus,
            hasFailureReason: Boolean(verification?.failureReason),
            emailOnFile: verification?.emailOnFile,
            hasCard: Boolean(rainOverview?.status?.hasApplication),
            balanceKnown,
            isZeroBalance: balanceKnown && smartBalance === 0n && !rainOverview?.balance?.spendingPower,
            isOffline: client.isOffline,
            isApiUnreachable: client.isApiUnreachable,
        }),
    }
}

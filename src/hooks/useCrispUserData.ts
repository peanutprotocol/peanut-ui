import { buildSupportVerificationSummary } from '@/utils/support-verification'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces/interfaces'
import { useEffect, useMemo, useReducer } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useModalsContext } from '@/context/ModalsContext'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { readCachedRainOverview, readCachedSmartBalance } from '@/utils/support-cache'
import {
    buildAccountStats,
    buildAppContext,
    buildBalanceSummary,
    buildCardSummary,
    buildLinkedAccounts,
    buildSupportLinks,
    buildSupportSegments,
} from '@/utils/support-context'
import { computeDisplaySpendable, isRainBalanceKnown } from '@/utils/balance.utils'
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
    // Account context — balance, points, card, linked accounts, device/build.
    balance: string | undefined
    accountStats: string | undefined
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
/** The cache entries the snapshot reads. Everything else is noise to it. */
const WATCHED_KEYS = new Set<unknown>(['balance', RAIN_CARD_OVERVIEW_QUERY_KEY])

export function useCrispUserData(): CrispUserData {
    const { username, userId, user } = useAuth()
    const queryClient = useQueryClient()
    const client = useSupportClientContext()
    const { isSupportModalOpen } = useModalsContext()

    /*
     * Cache reads are not subscriptions, so nothing re-renders when a query the
     * snapshot reads finally resolves. Open support while the balance is still
     * in flight and the sidebar would say `unavailable` for the whole
     * conversation, with a `balance-unavailable` segment routing on it —
     * accurate at the instant it was read, wrong a second later.
     *
     * So watch the cache, but only while support is open: outside an open cycle
     * nobody consumes the snapshot, and this hook is mounted app-wide. The
     * subscription is read-only — it observes what other components fetch and
     * never triggers a fetch itself, which is the whole point of reading the
     * cache rather than subscribing with useQuery.
     *
     * Re-render churn is bounded by the signature memo below: a cache event
     * that doesn't change a value leaves the snapshot's identity alone, so no
     * push to Crisp follows.
     */
    const [, onCacheChange] = useReducer((tick: number) => tick + 1, 0)
    useEffect(() => {
        if (!isSupportModalOpen) return
        const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
            if (event.type !== 'updated') return
            if (WATCHED_KEYS.has(event.query.queryKey[0])) onCacheChange()
        })
        /*
         * Re-read once now that the subscription is attached. The values above
         * were read during render; a balance or card query resolving between
         * that render and this effect emits its only `updated` event with
         * nobody listening, and the conversation would keep the initial
         * `unavailable` snapshot — and the routing flag derived from it — until
         * some unrelated render happened to recompute it.
         */
        onCacheChange()
        return unsubscribe
    }, [isSupportModalOpen, queryClient])

    const walletAddress =
        user?.accounts?.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier || undefined

    /*
     * Every cache entry read here is keyed by this user — the balance by their
     * wallet address, the card overview by their user id — and read only while
     * a user is authenticated.
     *
     * That is a deliberate limit on what this snapshot reports. Limits and
     * latest activity would be useful to an agent, but `[limits]` and
     * `[transactions]` carry no user id in their keys, so a cached entry cannot
     * be proved to belong to the person support is open for. They stay out
     * until those keys are user-scoped; see the follow-up. Do NOT add a read
     * here that cannot answer "whose data is this?" from the key alone.
     */
    const isAuthenticated = Boolean(userId && user)

    const smartBalance = isAuthenticated ? readCachedSmartBalance(queryClient, walletAddress) : undefined
    const rainOverview = isAuthenticated ? readCachedRainOverview(queryClient, userId) : undefined

    const snapshot = buildCrispUserData({
        username,
        userId,
        user,
        walletAddress,
        smartBalance,
        rainOverview,
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
    client: ReturnType<typeof useSupportClientContext>
}

function buildCrispUserData(input: CrispUserDataInput): CrispUserData {
    const { username, userId, user, walletAddress, smartBalance, rainOverview, client } = input

    // Use address from user.accounts (database) rather than useWallet hook
    // This ensures we always show the user's wallet address in support metadata,
    // even if ZeroDev client isn't initialized yet. useWallet().address could be
    // undefined during initialization, but we want persistent data for support agents.
    const links = buildSupportLinks(userId, walletAddress, user?.user?.bridgeCustomerId || undefined)

    // DATA GAP (flagged): the Manteca providerUserId used to come from the now-removed
    // raw `user.kycVerifications` field. Neither read-model carries it — `capabilities`
    // is provider-blind, `identityVerification` has no provider metadata. This was only
    // an internal support-dashboard convenience link (not user-facing, not a gate), so
    // it degrades to undefined until the backend exposes a provider-account id. Do NOT
    // fabricate it from capabilities.
    const mantecaUserId = undefined

    const email = user?.user?.email || undefined
    const verification = user
        ? buildSupportVerificationSummary(user.capabilities, user.identityVerification, email)
        : undefined

    const balance = user ? buildBalanceSummary(smartBalance, rainOverview) : undefined
    const balanceKnown = smartBalance !== undefined && isRainBalanceKnown(rainOverview)
    /*
     * Zero is decided by the SAME total the balance row prints. During the
     * smart-to-collateral handoff the funds are in neither bucket, and only
     * `inTransitToCollateralCents` accounts for them — reading the two halves
     * directly would show a funded balance beside a `zero-balance` flag.
     */
    const displaySpendable = balanceKnown
        ? computeDisplaySpendable(
              smartBalance as bigint,
              rainOverview?.balance?.spendingPower,
              rainOverview?.balance?.inTransitToCollateralCents
          )
        : undefined

    return {
        username,
        userId,
        email,
        fullName: user?.user?.fullName,
        avatar: user?.user?.profile_picture || undefined,
        walletAddress,
        ...links,
        mantecaUserId,
        identityStatus: verification?.identityStatus,
        emailOnFile: verification?.emailOnFile,
        verificationGates: verification?.gates,
        verificationRails: verification?.verificationRails,
        failureReason: verification?.failureReason,
        pendingActions: verification?.pendingActions,
        balance,
        accountStats: buildAccountStats(user ?? undefined),
        card: buildCardSummary(rainOverview),
        linkedAccounts: buildLinkedAccounts(user?.accounts),
        appContext: buildAppContext(client),
        segments: buildSupportSegments({
            isLoggedIn: Boolean(userId),
            platform: client.platform,
            identityStatus: verification?.identityStatus,
            hasFailureReason: Boolean(verification?.failureReason),
            emailOnFile: verification?.emailOnFile,
            hasCard: Boolean(rainOverview?.status?.hasApplication),
            balanceKnown,
            isZeroBalance: displaySpendable === 0n,
            isOffline: client.isOffline,
            isApiUnreachable: client.isApiUnreachable,
        }),
    }
}

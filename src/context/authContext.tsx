'use client'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useUserQuery } from '@/hooks/query/user'
import { useUserAutoRefresh } from '@/hooks/useUserAutoRefresh'
import type { IUserProfile } from '@/interfaces/interfaces'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { userActions } from '@/redux/slices/user-slice'
import { zerodevActions } from '@/redux/slices/zerodev-slice'
import {
    removeFromCookie,
    syncLocalStorageToCookie,
    clearRedirectUrl,
    updateUserPreferences,
} from '@/utils/general.utils'
import { apiFetch } from '@/utils/api-fetch'
import { useAppLocked } from '@/hooks/useAppLocked'
import { currentAppLocale, currentDeviceContext } from '@/i18n/app/locale-store'
import { isCapacitor } from '@/utils/capacitor'
import { clearAuthToken } from '@/utils/auth-token'
import { resetCrispProxySessions } from '@/utils/crisp'
import { disableDemoMode } from '@/utils/demo'
import posthog from 'posthog-js'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { captureException, setUser as setSentryUser } from '@/utils/sentry-lazy'
// import { PUBLIC_ROUTES_REGEX } from '@/constants/routes'
import { USER_DATA_CACHE_PATTERNS } from '@/constants/cache.consts'
import { purgeCaches } from '@/utils/cache.utils'
import { clearStepUpToken } from '@/services/step-up'
import { claimAndSettlePendingBadgeCampaigns, isConfirmedBadgeCampaignClaim } from '@/services/badge-campaigns'
import { clearPendingBadgeCampaigns, getPendingBadgeCampaigns } from '@/components/Invites/badge-campaign-context'

interface AuthContextType {
    user: IUserProfile | null
    userId: string | undefined
    username: string | undefined
    fetchUser: () => Promise<IUserProfile | null>
    addAccount: ({
        accountIdentifier,
        accountType,
        userId,
        connector,
        telegramHandle,
    }: {
        accountIdentifier: string
        accountType: string
        userId: string
        telegramHandle?: string
        connector?: {
            iconUrl: string
            name: string
        }
    }) => Promise<void>
    isFetchingUser: boolean
    userFetchError: Error | null
    logoutUser: (options?: { skipBackendCall?: boolean }) => Promise<void>
    isLoggingOut: boolean
    invitedUsernamesSet: Set<string>
}
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Context provider to manage user authentication and profile interactions.
 * It handles fetching the user profile, updating user details (e.g., username, profile photo),
 * adding accounts and logging out. It also provides hooks for child components to access user data and auth-related functions.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const dispatch = useAppDispatch()
    const toast = useToast()
    const tErrors = useTranslations('errors')
    const queryClient = useQueryClient()
    const WEB_AUTHN_COOKIE_KEY = 'web-authn-key'

    // While the native app lock is engaged the session is paused: disabling
    // the query here also disables its refetchOnMount/refetchOnWindowFocus,
    // so a resume can't race a request out before the unlock ceremony. When
    // the lock lifts, react-query refetches stale data on its own — that IS
    // the post-unlock refresh.
    const appLocked = useAppLocked()
    const {
        data: user,
        isLoading: isFetchingUser,
        refetch: fetchUser,
        error: userFetchError,
    } = useUserQuery(!appLocked)

    // Singleton auto-refresh poller — keeps the user query fresh while any
    // rail is provisioning OR a recent submission window is open. Mounted
    // here (rather than in useCapabilities) so N consumers share ONE interval
    // + one in-flight guard. See useUserAutoRefresh for the predicate.
    useUserAutoRefresh({ user, fetchUser })

    // Pre-compute a Set of invited usernames for O(1) lookups
    const invitedUsernamesSet = useMemo(() => {
        if (!user?.invitesSent) return new Set<string>()
        return new Set(user.invitesSent.map((invite) => invite.inviteeUsername))
    }, [user?.invitesSent])

    /*
     * Drop every cached query when the signed-in account CHANGES.
     *
     * An explicit logout already clears the cache below, but a session that
     * expires passively never runs that path: /users/me 401s, and query keys
     * that carry no user id — `[limits]`, `[transactions]` — stay warm. Sign a
     * different account in on that device and react-query serves the previous
     * account's rows until each refetch lands, so the new user briefly sees
     * someone else's Activity, limits, and (via the support snapshot) their
     * last transaction.
     *
     * Only fires on a change BETWEEN accounts. The first sign-in of a session
     * (undefined → id) keeps whatever a guest legitimately prefetched, e.g. a
     * claim link opened before signing in.
     */
    const lastUserIdRef = useRef<string | undefined>(undefined)
    useEffect(() => {
        const currentUserId = user?.user?.userId
        const previousUserId = lastUserIdRef.current
        lastUserIdRef.current = currentUserId ?? previousUserId
        if (currentUserId && previousUserId && currentUserId !== previousUserId) {
            queryClient.clear()
        }
    }, [user?.user?.userId, queryClient])

    useEffect(() => {
        if (user) {
            syncLocalStorageToCookie(WEB_AUTHN_COOKIE_KEY)
            if (typeof window !== 'undefined' && window.gtag) {
                window.gtag('set', { user_id: user.user.userId })
            }
            // PostHog: identify user (stitches anonymous pre-login events to this user)
            // and enrich the person profile for segmentation. Property names mirror the
            // server-side identify in peanut-api-ts src/log/identifyUser.ts — keep in sync.
            // `name` duplicates username because PostHog's Persons-page search is
            // hardcoded to email/name/distinct_id — username alone is not searchable.
            const enabledRails = user.rails?.filter((rail) => rail.status === 'ENABLED') ?? []
            const appLocale = currentAppLocale()
            posthog.identify(user.user.userId, {
                username: user.user.username,
                name: user.user.username,
                userId: user.user.userId,
                totalPoints: user.totalPoints,
                // Badge codes (human-readable identifier), never the uuid.
                badges: user.user.badges?.map((badge) => badge.code) ?? [],
                kycStatus: user.identityVerification?.status ?? 'not_started',
                // Human-readable PROVIDER:METHOD codes for cohorting, plus the
                // catalog rail ids for joins against the rails table.
                enabledRails: enabledRails.map((rail) => `${rail.rail.provider.code}:${rail.rail.method.code}`),
                enabledRailIds: enabledRails.map((rail) => rail.rail.id),
                // Client-set (the BE mirror lives in users.locale via LocaleSync)
                // — covers the first session, where the startup locale resolves
                // before identify.
                ...(appLocale ? { app_locale: appLocale } : {}),
            })
            // Sentry: every error captured from here on inherits user context
            // as searchable Sentry tags. Closes the historical gap where FE
            // errors were anonymous and had to be cross-referenced via the
            // posthog $sentry_url field to figure out which user hit them.
            setSentryUser({
                id: user.user.userId,
                username: user.user.username ?? undefined,
                email: user.user.email ?? undefined,
            })
        } else {
            // Logout / unauthenticated: clear Sentry user so subsequent
            // anonymous-session errors don't get misattributed.
            setSentryUser(null)
        }
    }, [user])

    // Returning-user and app-restart recovery. Invite attribution is handled
    // elsewhere; this only resumes opaque campaign identities after auth. The
    // claim service de-dupes concurrent registration/page attempts and retains
    // only retryable tags.
    useEffect(() => {
        const userId = user?.user.userId
        if (!userId) return

        const badgeCampaigns = getPendingBadgeCampaigns()
        if (badgeCampaigns.length === 0) return

        let cancelled = false
        void claimAndSettlePendingBadgeCampaigns(badgeCampaigns).then(async (batch) => {
            if (cancelled) return
            if (batch.claims.some(isConfirmedBadgeCampaignClaim)) {
                try {
                    await fetchUser()
                } catch (error) {
                    captureException(error, { tags: { error_type: 'campaign_profile_refresh_failed' } })
                }
            }
            if (batch.pending.length > 0) {
                captureException(new Error('authenticated campaign claim retained for retry'), {
                    tags: { error_type: 'campaign_claim_retryable' },
                    extra: { userId, pendingCampaigns: batch.pending, claims: batch.claims },
                })
            }
        })

        return () => {
            cancelled = true
        }
    }, [user?.user.userId, fetchUser])

    const legacy_fetchUser = useCallback(async () => {
        const { data: fetchedUser } = await fetchUser()
        return fetchedUser ?? null
    }, [fetchUser])

    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const addAccount = async ({
        accountIdentifier,
        accountType,
        userId,
        bridgeAccountId,
        connector,
        telegramHandle,
    }: {
        accountIdentifier: string
        accountType: string
        userId: string
        bridgeAccountId?: string
        connector?: {
            iconUrl: string
            name: string
        }
        telegramHandle?: string
    }) => {
        console.log('[addAccount] Starting account addition', { userId, accountType })

        const response = await apiFetch('/add-account', {
            method: 'POST',
            body: JSON.stringify({
                userId,
                accountIdentifier,
                bridgeAccountId,
                accountType,
                connector,
                telegramHandle,
            }),
        })

        if (!response.ok) {
            console.error('[addAccount] Failed to add account', {
                status: response.status,
                statusText: response.statusText,
            })

            if (response.status === 409) {
                throw new Error('Account already exists')
            }
            console.error('Unexpected error adding account', response)
            throw new Error('Unexpected error adding account')
        }

        console.log('[addAccount] Account added successfully, fetching user data')

        // CRITICAL FIX: Wait for user data to be fetched before continuing
        // This ensures JWT cookie is set and user data is available before redirect
        const { data: updatedUser } = await fetchUser()

        if (!updatedUser) {
            console.error('[addAccount] Failed to fetch user after account creation')
            throw new Error('Failed to load user data after account creation')
        }

        console.log('[addAccount] User data fetched successfully', {
            userId: updatedUser.user.userId,
            accountCount: updatedUser.accounts.length,
        })
    }

    /**
     * Clears all client-side auth state (cookies, localStorage, redux, caches)
     * Used by both normal logout and force logout (when backend is down)
     */
    const clearLocalAuthState = useCallback(async () => {
        // clear user preferences (webauthn key in localStorage)
        updateUserPreferences(user?.user.userId, { webAuthnKey: undefined })

        /*
         * Cancel queries BEFORE wiping the token: an in-flight /users/me can carry a
         * sliding-refresh token and would re-persist it into native Preferences right
         * after the clear, so logout never sticks (Android splash-loop, kuxhagra).
         */
        try {
            await queryClient.cancelQueries()
            queryClient.clear()
        } catch (e) {
            console.warn('failed to clear queries on logout:', e)
        }

        // clear auth tokens (localStorage in capacitor, cookie on web)
        removeFromCookie(WEB_AUTHN_COOKIE_KEY)
        await clearAuthToken()

        // clear redirect url
        clearRedirectUrl()

        // Pending badge campaigns are bearer acquisition intents. An explicit
        // logout is an intentional account switch, so never let the next
        // account on this browser inherit the previous account's award path.
        // Passive auth expiry does not run this cleanup and retains retries.
        clearPendingBadgeCampaigns()

        // The invite cookie routes /setup past Landing — the only screen with
        // Log In. A signed-in native user who tapped a friend's invite App Link
        // has it set; leaving it through logout would strand them on Signup,
        // unable to log back in until the process dies (session cookie).
        removeFromCookie('inviteCode')

        // A cached step-up proof outliving the session would let the next user
        // of this device skip verification on card and withdrawal screens.
        clearStepUpToken()

        // NOTE: main also cancelled/cleared queries here. That already happens
        // above, deliberately BEFORE the token wipe — an in-flight /users/me can
        // re-persist a sliding-refresh token into native Preferences otherwise
        // (Android post-logout splash loop). Don't move it back down.

        // reset redux state (user, setup, zerodev)
        dispatch(userActions.setUser(null))
        dispatch(setupActions.resetSetup())
        dispatch(zerodevActions.resetZeroDevState())

        // clear service worker caches (non-fatal if it fails)
        await purgeCaches(USER_DATA_CACHE_PATTERNS)

        // clear session flags
        try {
            sessionStorage.removeItem('hasSeenIOSPWAPromptThisSession')
        } catch {}

        // clear demo mode flag
        disableDemoMode()

        // reset third-party sessions (non-fatal)
        try {
            resetCrispProxySessions()
        } catch (e) {
            console.warn('crisp reset failed:', e)
        }
        try {
            posthog.reset()
            // reset() wipes registered super properties — re-register the
            // locale so logout-window events keep carrying app_locale
            const locale = currentAppLocale()
            if (locale) posthog.register({ app_locale: locale })
            // same for the localization-OKR device context (device_language + platform)
            const deviceContext = currentDeviceContext()
            if (deviceContext) posthog.register(deviceContext)
        } catch (e) {
            console.warn('posthog reset failed:', e)
        }
    }, [dispatch, queryClient, user?.user.userId])

    /**
     * Logs out the user
     * @param options.skipBackendCall - If true, skips the backend logout call (useful when backend is down)
     */
    const logoutUser = useCallback(
        async (options?: { skipBackendCall?: boolean }) => {
            if (isLoggingOut) return

            setIsLoggingOut(true)
            try {
                /*
                 * Revoke server-side FIRST (needs the still-valid JWT): POST
                 * /users/logout bumps the account's tokenVersion so every
                 * outstanding JWT — this device and any other — stops
                 * verifying. Best-effort: a dead backend must never trap the
                 * user in a session, so failures fall through to local logout.
                 */
                if (!options?.skipBackendCall) {
                    try {
                        await apiFetch('/users/logout', { method: 'POST' })
                    } catch (e) {
                        console.warn('server-side session revocation failed, continuing local logout:', e)
                    }
                }

                await clearLocalAuthState()

                // fetch user (should return null after logout) - skip for capacitor
                // (jwt is already cleared, fetching would just 401)
                if (!options?.skipBackendCall && !isCapacitor()) {
                    await fetchUser()
                }

                // force full page refresh to /setup to clear all state
                window.location.href = '/setup'
            } catch (error) {
                captureException(error)
                console.error('Error logging out user', error)
                // TODO: remove debug info after native testing
                toast.error(tErrors('logoutFailed'))
            } finally {
                setIsLoggingOut(false)
            }
        },
        [clearLocalAuthState, fetchUser, isLoggingOut, toast, tErrors]
    )

    return (
        <AuthContext.Provider
            value={{
                user: user ?? null,
                userId: user?.user?.userId,
                username: user?.user?.username ?? undefined,
                fetchUser: legacy_fetchUser,
                addAccount,
                isFetchingUser,
                userFetchError: userFetchError ?? null,
                logoutUser,
                isLoggingOut,
                invitedUsernamesSet,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

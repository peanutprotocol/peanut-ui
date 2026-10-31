'use client'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/0_Bruddle/Toast'
import { USER } from '@/constants/query.consts'
import { recoverLoginSession } from '@/utils/login-session'
import { useUserQuery } from '@/hooks/query/user'
import { useUserAutoRefresh } from '@/hooks/useUserAutoRefresh'
import type { IUserProfile } from '@/interfaces/interfaces'
import type { SignupPreferences } from '@/types/signup-preferences'
import { zeroDevFlowActions } from '@/hooks/useZeroDevFlow'
import {
    removeFromCookie,
    syncLocalStorageToCookie,
    beginIntentionalLogout,
    clearRedirectUrl,
    endIntentionalLogout,
    updateUserPreferences,
} from '@/utils/general.utils'
import { clearSessionHeld } from '@/utils/session-presence'
import { apiFetch } from '@/utils/api-fetch'
import { useAppLocked } from '@/hooks/useAppLocked'
import { currentAppLocale, currentDeviceContext, currentDeviceIdentity } from '@/i18n/app/locale-store'
import { isCapacitor } from '@/utils/capacitor'
import { clearAnalyticsIdentity, identifyAnalyticsUser } from '@/utils/posthog-identity'
import { clearAuthToken } from '@/utils/auth-token'
import { resetCrispProxySessions } from '@/utils/crisp'
import { disableDemoMode, isDemoMode } from '@/utils/demo'
import {
    getNotificationLogoutVersion,
    logoutNotificationIdentity,
    onNotificationIdentityLoginAvailable,
    reconcileNotificationIdentity,
    resumeNotificationIdentity,
} from '@/services/onesignal/identity'
import { reportPushIdentityFailure } from '@/services/onesignal/identity-report'
import posthog from 'posthog-js'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { captureException, setUser as setSentryUser } from '@/utils/sentry-lazy'
// import { PUBLIC_ROUTES_REGEX } from '@/constants/routes'
import { USER_DATA_CACHE_PATTERNS } from '@/constants/cache.consts'
import { purgeCaches } from '@/utils/cache.utils'
import { clearStepUpToken } from '@/services/step-up'
import {
    draftResidenceOf,
    forgetAnswerDraft,
    forgetAnswerDraftOnResidenceChange,
} from '@/features/paperwork-verification/answerDraft'
import { claimAndSettlePendingBadgeCampaigns, isConfirmedBadgeCampaignClaim } from '@/services/badge-campaigns'
import { clearPendingBadgeCampaigns, getPendingBadgeCampaigns } from '@/components/Invites/badge-campaign-context'
import { clearInvite } from '@/utils/invite-stash'
import { resumeSignupGeo } from '@/services/signup-geo'
import { attachSignupAttribution } from '@/services/signup-attribution'
import { clearSignupAttribution } from '@/utils/signup-attribution'
import { completeAccountSetup, type AccountSetupOutcome } from '@/services/account-setup'
import { settlePendingInviteAttribution } from '@/services/pending-invite-attribution'

interface AuthContextType {
    user: IUserProfile | null
    userId: string | undefined
    username: string | undefined
    /**
     * Re-fetch the profile. A failed refresh (5xx, 429, network) keeps the cached
     * profile and resolves with it; `throwOnError` rejects instead, for a caller
     * that must not act on a profile the refresh could not confirm.
     */
    fetchUser: (options?: { throwOnError?: boolean }) => Promise<IUserProfile | null>
    hydrateLoginSession: () => Promise<IUserProfile>
    addAccount: ({
        accountIdentifier,
        accountType,
        userId,
        connector,
        telegramHandle,
        signupPreferences,
    }: {
        accountIdentifier: string
        accountType: string
        userId: string
        telegramHandle?: string
        signupPreferences?: SignupPreferences
        connector?: {
            iconUrl: string
            name: string
        }
    }) => Promise<AccountSetupOutcome>
    isFetchingUser: boolean
    userFetchError: Error | null
    logoutUser: (options?: { skipBackendCall?: boolean; allDevices?: boolean }) => Promise<void>
    isLoggingOut: boolean
    invitedUsernamesSet: Set<string>
}
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Context provider to manage user authentication and profile interactions.
 * It handles fetching the user profile, updating user details (e.g., username, profile photo),
 * adding accounts and logging out. It also provides hooks for child components to access user data and auth-related functions.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const logoutGeneration = useRef(0)
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

    const geoUserId = user?.user?.userId
    useEffect(() => {
        if (!geoUserId || appLocked) return
        return resumeSignupGeo(geoUserId)
    }, [geoUserId, appLocked])

    // Unsaved verification answers typed for one country must not outlive a move to another.
    const declaredResidence = draftResidenceOf(user)
    useEffect(() => {
        forgetAnswerDraftOnResidenceChange(geoUserId, declaredResidence)
    }, [geoUserId, declaredResidence])

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
            // This effect runs on every user refetch; identifyAnalyticsUser sends
            // only an id change or changed properties.
            const enabledRails = user.rails?.filter((rail) => rail.status === 'ENABLED') ?? []
            const appLocale = currentAppLocale()
            identifyAnalyticsUser(user.user.userId, {
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
                // Device identity is a super property, which reaches events but
                // never the person profile. A visitor who was anonymous when it
                // resolved got no $set, so without this the slow-device cohorts
                // would omit everyone who identifies after startup.
                ...(currentDeviceIdentity() ?? {}),
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
            // Covers a native restart or a transient API outage after signup.
            // The service is idempotent and clears local evidence only after
            // the authenticated endpoint acknowledges it.
            void attachSignupAttribution(user.user.userId).catch((error) =>
                captureException(error, { level: 'warning', tags: { error_type: 'signup_attribution_retry_failed' } })
            )
        } else {
            // Logout / unauthenticated: clear Sentry user so subsequent
            // anonymous-session errors don't get misattributed.
            setSentryUser(null)
        }
    }, [user])

    // Returning-user and app-restart recovery. Referral attribution and opaque
    // campaigns are independent durable hand-offs; neither blocks app access.
    // Both services de-dupe concurrent registration/page attempts.
    useEffect(() => {
        const userId = user?.user.userId
        if (!userId) return

        let cancelled = false
        void settlePendingInviteAttribution(userId).then(async (outcome) => {
            if (cancelled || outcome.status !== 'attributed') return
            try {
                await fetchUser()
            } catch (error) {
                captureException(error, { tags: { error_type: 'invite_profile_refresh_failed' } })
            }
        })

        const badgeCampaigns = getPendingBadgeCampaigns()
        if (badgeCampaigns.length > 0) {
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
        }

        return () => {
            cancelled = true
        }
    }, [user?.user.userId, fetchUser])

    const legacy_fetchUser = useCallback(
        async (options?: { throwOnError?: boolean }) => {
            const { data: fetchedUser, error } = await fetchUser()
            if (options?.throwOnError && error) throw error
            return fetchedUser ?? null
        },
        [fetchUser]
    )

    const hydrateLoginSession = useCallback(async () => {
        const generation = logoutGeneration.current
        const pushLogoutVersion = getNotificationLogoutVersion()
        const cancel = () => queryClient.cancelQueries({ queryKey: [USER] })
        await cancel()
        const profile = await recoverLoginSession(async () => {
            const result = await fetchUser()
            if (result.error) throw result.error
            return result.data ?? null
        }, cancel)
        if (generation === logoutGeneration.current && pushLogoutVersion === getNotificationLogoutVersion()) {
            void resumeNotificationIdentity(profile.user.userId).catch((error) => {
                reportPushIdentityFailure('Push identity login failed', 'push_identity_login', error)
            })
        }
        return profile
    }, [fetchUser, queryClient])

    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const loggingOut = useRef(false)
    const pushExternalId = user?.user.userId ?? null
    const pushProfileResolved = user !== undefined

    useEffect(() => {
        // A locked/hydrating session or failed profile read is not confirmed logout.
        if (!pushProfileResolved || appLocked || isFetchingUser || userFetchError || isLoggingOut || isDemoMode())
            return
        let active = true
        const reconcile = () => {
            if (!active || loggingOut.current || isDemoMode() || document.visibilityState === 'hidden') return
            // Query cache updates precede React's scheduled observer render.
            // Queued lifecycle callbacks must not reuse the old rendered ID.
            const currentProfile = queryClient.getQueryData<IUserProfile | null>([USER])
            if (currentProfile === undefined) return
            void reconcileNotificationIdentity(currentProfile?.user.userId ?? null, async () => {
                if (!active || loggingOut.current || isDemoMode()) return null
                const result = await fetchUser({ cancelRefetch: false })
                if (!active || loggingOut.current || isDemoMode()) return null
                if (result.error) throw result.error
                return result.data?.user?.userId ?? null
            }).catch((error) => {
                reportPushIdentityFailure('Push identity reconciliation failed', 'push_identity_reconcile', error)
            })
        }
        const unsubscribe = onNotificationIdentityLoginAvailable(reconcile)
        reconcile()
        window.addEventListener('online', reconcile)
        document.addEventListener('visibilitychange', reconcile)
        return () => {
            active = false
            unsubscribe()
            window.removeEventListener('online', reconcile)
            document.removeEventListener('visibilitychange', reconcile)
        }
    }, [
        appLocked,
        isFetchingUser,
        userFetchError,
        isLoggingOut,
        pushExternalId,
        pushProfileResolved,
        fetchUser,
        queryClient,
    ])

    const addAccount = async ({
        accountIdentifier,
        accountType,
        userId,
        bridgeAccountId,
        connector,
        telegramHandle,
        signupPreferences,
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
        signupPreferences?: SignupPreferences
    }) => {
        const generation = logoutGeneration.current
        const pushLogoutVersion = getNotificationLogoutVersion()
        const outcome = await completeAccountSetup({
            accountIdentifier,
            accountType,
            fetchProfile: legacy_fetchUser,
            signupPreferences,
            request: () =>
                apiFetch('/add-account', {
                    method: 'POST',
                    body: JSON.stringify({
                        userId,
                        accountIdentifier,
                        bridgeAccountId,
                        accountType,
                        connector,
                        telegramHandle,
                        ...(signupPreferences ? { signupPreferences } : {}),
                    }),
                }),
        })
        if (generation === logoutGeneration.current && pushLogoutVersion === getNotificationLogoutVersion()) {
            void resumeNotificationIdentity(userId).catch((error) => {
                reportPushIdentityFailure('Push identity login failed', 'push_identity_login', error)
            })
        }
        return outcome
    }

    /**
     * Clears all client-side auth state (cookies, localStorage, query cache, zerodev flags)
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

        // The invite stash routes /setup past Landing — the only screen with
        // Log In. A signed-in native user who tapped a friend's invite App Link
        // has it set; leaving it through logout would open Signup instead of
        // Log In until the stash expires.
        clearInvite()

        // Source context is account-linkable; an explicit account switch must
        // never let the next user inherit the previous user's journey.
        await clearSignupAttribution()

        // A cached step-up proof outliving the session would let the next user
        // of this device skip verification on card and withdrawal screens.
        clearStepUpToken()

        // Unsaved verification answers belong to this account only.
        forgetAnswerDraft(user?.user.userId)

        // NOTE: main also cancelled/cleared queries here. That already happens
        // above, deliberately BEFORE the token wipe — an in-flight /users/me can
        // re-persist a sliding-refresh token into native Preferences otherwise
        // (Android post-logout splash loop). Don't move it back down.

        // The user query cache is already gone (queryClient.clear() above)
        // and the invite stash is cleared once at the top of logout — reset
        // the zerodev flow flags too.
        zeroDevFlowActions.reset()

        // clear service worker caches (non-fatal if it fails)
        await purgeCaches(USER_DATA_CACHE_PATTERNS)

        // This tab is a logged-out tab again, so a deep link opened in it later
        // is that person's own intent rather than a dead session's residue.
        clearSessionHeld()

        // clear demo mode flag
        disableDemoMode()

        // reset third-party sessions (non-fatal)
        void resetCrispProxySessions().catch((e) => console.warn('crisp reset failed:', e))
        try {
            posthog.reset()
            clearAnalyticsIdentity()
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
    }, [queryClient, user?.user.userId])

    /**
     * Logs out the user on this device. The account stays signed in elsewhere.
     * @param options.skipBackendCall - If true, skips the backend logout call, leaving this
     * device's session valid server-side (backend down, or a forced re-auth about this device's key)
     * @param options.allDevices - If true, also signs the account out on every other device
     */
    const logoutUser = useCallback(
        async (options?: { skipBackendCall?: boolean; allDevices?: boolean }) => {
            if (loggingOut.current) return

            loggingOut.current = true
            logoutGeneration.current += 1
            setIsLoggingOut(true)
            // Before anything empties the user cache: the auth gate reacts to
            // that by storing the current path as the post-auth destination.
            beginIntentionalLogout()
            // Start before any auth await; SDK events cannot relink the old user.
            const pushLogout = logoutNotificationIdentity().catch((error) => {
                reportPushIdentityFailure('Push identity logout failed or timed out', 'push_identity_logout', error)
            })
            try {
                /*
                 * Revoke server-side FIRST (needs the still-valid JWT): POST
                 * /users/logout revokes this device's session, /users/logout/all
                 * bumps the account's tokenVersion so every outstanding JWT
                 * stops verifying. Best-effort: a dead backend must never trap
                 * the user in a session, so failures fall through to local logout.
                 */
                if (!options?.skipBackendCall) {
                    try {
                        const response = await apiFetch(options?.allDevices ? '/users/logout/all' : '/users/logout', {
                            method: 'POST',
                        })
                        // an API without /all still revokes every session on /users/logout
                        if (options?.allDevices && response?.status === 404) {
                            await apiFetch('/users/logout', { method: 'POST' })
                        }
                    } catch (e) {
                        console.warn('server-side session revocation failed, continuing local logout:', e)
                    }
                }

                await pushLogout
                await clearLocalAuthState()

                // fetch user (should return null after logout) - skip for capacitor
                // (jwt is already cleared, fetching would just 401)
                if (!options?.skipBackendCall && !isCapacitor()) {
                    await fetchUser()
                }

                // force full page refresh to /setup to clear all state
                window.location.href = '/setup'
            } catch (error) {
                // The hard nav never happened, so this document keeps serving
                // the app — a later deep-link bounce must store its target again.
                endIntentionalLogout()
                captureException(error)
                console.error('Error logging out user', error)
                // TODO: remove debug info after native testing
                toast.error(tErrors('logoutFailed'))
            } finally {
                loggingOut.current = false
                setIsLoggingOut(false)
            }
        },
        [clearLocalAuthState, fetchUser, toast, tErrors]
    )

    return (
        <AuthContext.Provider
            value={{
                user: user ?? null,
                userId: user?.user?.userId,
                username: user?.user?.username ?? undefined,
                fetchUser: legacy_fetchUser,
                hydrateLoginSession,
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

/**
 * For components that also render on signed-out surfaces — the claim pages
 * mount the country list with no provider above them. Returns null there, so
 * the caller has to say what it does without a user.
 */
export const useOptionalAuth = (): AuthContextType | null => useContext(AuthContext) ?? null

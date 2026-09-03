'use client'

import { PASSKEY_SERVER_URL } from '@/constants/zerodev.consts'
import { WEB_AUTHN_COOKIE_KEY } from '@/constants/auth.consts'
import { loadingStateContext } from '@/context/loadingStates.context'
import { useAuth } from '@/context/authContext'
import { useKernelClient } from '@/context/kernelClient.context'
import { useAppDispatch, useSetupStore, useZerodevStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { zerodevActions } from '@/redux/slices/zerodev-slice'
import { getFromCookie, removeFromCookie, saveToCookie, saveToLocalStorage } from '@/utils/general.utils'
import { clearAuthState } from '@/utils/auth.utils'
import { isStaleKeyError, createStaleSessionError } from '@/utils/walletCredential.utils'
import { capturePasskeySignFailure, classifyPasskeyError, normalizePasskeyServerError } from '@/utils/webauthn.utils'
import { withCeremonyPurpose } from '@/utils/webauthn-ceremony-telemetry'
import {
    captureCeremonyGuardError,
    guardPasskeyCeremony,
    isCeremonyGuardError,
    isPasskeyShimInstalled,
} from '@/utils/passkeyCeremony.utils'
import { toWebAuthnKey, WebAuthnMode } from '@zerodev/passkey-validator'
import { useCallback, useContext } from 'react'
import type { TransactionReceipt, Hex, Hash } from 'viem'
import { captureException } from '@sentry/nextjs'
import { invitesApi } from '@/services/invites'
import {
    claimAndSettlePendingBadgeCampaigns,
    isConfirmedBadgeCampaignClaim,
    isUnavailableBadgeCampaignClaim,
} from '@/services/badge-campaigns'
import { settleAcceptedInviteAcquisition } from '@/services/invite-acquisition'
import { getPendingBadgeCampaigns } from '@/components/Invites/badge-campaign-context'
import { settleShhhhhCampaignContinuation } from '@/app/shhhhh/shhhhh-acquisition'
import { signupConsentDocuments } from '@/services/consent'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { isCapacitor, getNativeRpId } from '@/utils/capacitor'
import { isDemoMode } from '@/utils/demo'
import { rescueUserOpReceipt } from '@/utils/userop-rescue.utils'

// types
type UserOpEncodedParams = {
    to: Hex
    value?: bigint | undefined
    data?: Hex | undefined
}

// Placeholder hash for simulated demo spends.
const DEMO_USEROP_HASH = `0x${'de'.repeat(32)}` as Hash

// custom error class for passkey-related errors
class PasskeyError extends Error {
    constructor(
        message: string,
        public code: string
    ) {
        super(message)
        this.name = 'PasskeyError'
    }
}

export const useZeroDev = () => {
    const dispatch = useAppDispatch()
    const { user, logoutUser } = useAuth()
    const { isKernelClientReady, isRegistering, isLoggingIn, isSendingUserOp, address } = useZerodevStore()
    const { setWebAuthnKey, getClientForChain, ensureClientForChain } = useKernelClient()
    const { setLoadingState } = useContext(loadingStateContext)
    const { inviteCode, inviteType } = useSetupStore()

    // Future note: could be `${username}.${process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || 'peanut.me'}` (have to change BE too)
    const _getPasskeyName = (username: string) => `${username}.peanut.wallet`

    // register function
    const handleRegister = async (username: string): Promise<void> => {
        // CRITICAL: clear any stale state from previous user before registering new passkey
        // this is the SINGLE place where cleanup happens for new signups
        // handles cases where: old cookies persist, session expired, user didn't logout properly
        console.log('[useZeroDev] starting new passkey registration, clearing any stale state')
        removeFromCookie(WEB_AUTHN_COOKIE_KEY) // clear old passkey cookie
        dispatch(zerodevActions.resetZeroDevState()) // clear redux state (including old address)

        dispatch(zerodevActions.setIsRegistering(true))
        try {
            const rpId = isCapacitor() ? getNativeRpId() : window.location.hostname.replace(/^www\./, '')

            // @capgo/capacitor-passkey shim patches navigator.credentials on native,
            // so toWebAuthnKey works on all platforms (web, android, ios).
            // Same TASK-21782 guard as login: native shim gate + 60s bound —
            // signup is the tightest shim race (first tap after a fresh install).
            const webAuthnKey = await withCeremonyPurpose('registration', () =>
                guardPasskeyCeremony(() =>
                    toWebAuthnKey({
                        passkeyName: _getPasskeyName(username),
                        passkeyServerUrl: PASSKEY_SERVER_URL as string,
                        mode: WebAuthnMode.Register,
                        // Consent-ledger echo (tos-v1 phase 2): the ZeroDev SDK owns the
                        // register/verify request body, so the terms+privacy versions the
                        // signup screen displayed ride in a header the backend ledgers.
                        passkeyServerHeaders: { 'x-accepted-legal': JSON.stringify(signupConsentDocuments()) },
                        rpID: rpId,
                    })
                )
            )

            const inviteCodeFromCookie = getFromCookie('inviteCode')

            // invite code can also be store in cookies, so we need to check both
            const userInviteCode = inviteCode || inviteCodeFromCookie
            const badgeCampaigns = getPendingBadgeCampaigns()

            if (userInviteCode?.trim().length > 0) {
                /*
                 * Fail-open by design: a broken accept must not block signup. But a
                 * failure here strands the user in the waitlist, so (1) persist the
                 * code in the cookie — JoinWaitlistPage auto-retries from it, even
                 * after an app restart — and (2) report to Sentry, not just PostHog:
                 * a systematic accept failure looks like a completed signup otherwise.
                 * The cookie is only cleared on confirmed success.
                 */
                const keepInviteCodeForRetry = () => saveToCookie('inviteCode', userInviteCode, 30)
                const clearAcceptedInviteCode = () => {
                    removeFromCookie('inviteCode')
                    dispatch(setupActions.setInviteCode(''))
                }
                try {
                    const result = await invitesApi.acceptInvite(userInviteCode, inviteType)
                    let campaignOnlyProcessed = false
                    if (result.success) {
                        if (result.legacyAcquisition) {
                            const acceptedBadgeCampaigns = [result.legacyAcquisition.campaignTag]
                            const { destination, pending } = settleAcceptedInviteAcquisition(
                                result.legacyAcquisition,
                                result.claims
                            )

                            // Keep an already-published migration continuation
                            // through setup only after the matching claim confirms.
                            if (destination !== '/home') saveToLocalStorage('redirect', destination)
                            if (pending.some((tag) => tag.toLowerCase() === acceptedBadgeCampaigns[0].toLowerCase())) {
                                captureException(new Error('accept-time legacy acquisition retained for retry'), {
                                    tags: { error_type: 'invite_accept_campaign_retryable' },
                                    extra: {
                                        inviteCode: userInviteCode,
                                        pendingCampaigns: pending,
                                        claims: result.claims,
                                    },
                                })
                            }
                            if (!result.onboardingResolved) {
                                // A NONE adapter is not an invite retry. Its
                                // terminal claim is done; any retryable state is
                                // now carried solely by the versioned campaign queue.
                                campaignOnlyProcessed = true
                                clearAcceptedInviteCode()
                            }
                        }
                    }

                    if (result.success && result.onboardingResolved) {
                        posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPTED, {
                            invite_code: userInviteCode,
                            invite_type: inviteType,
                            campaign_tag: badgeCampaigns[0],
                            campaign_tags: badgeCampaigns,
                        })
                        clearAcceptedInviteCode()
                    } else if (campaignOnlyProcessed) {
                        // Deliberately no onboarding-failed analytics/Sentry:
                        // campaign-only compatibility resolved as designed.
                    } else {
                        posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, {
                            invite_code: userInviteCode,
                            error_message: result.success
                                ? 'Invite did not resolve onboarding'
                                : 'API returned unsuccessful',
                        })
                        captureException(new Error('register-time invite onboarding unresolved'), {
                            tags: { error_type: 'invite_accept_failed' },
                            extra: { inviteCode: userInviteCode, result },
                        })
                        keepInviteCodeForRetry()
                        console.error('Error accepting invite', result)
                    }
                } catch (e) {
                    posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, {
                        invite_code: userInviteCode,
                        error_message: String(e),
                    })
                    captureException(e, {
                        tags: { error_type: 'invite_accept_failed' },
                        extra: { inviteCode: userInviteCode },
                    })
                    keepInviteCodeForRetry()
                    console.error('Error accepting invite', e)
                }
            }

            // Campaign acquisition is independent from invite attribution. It
            // runs after authentication whether or not an invite was present,
            // and per-tag settlement keeps only transport/configuration retries.
            // Re-read after `/invites/accept`: a confirmed legacy adapter may
            // have settled the same tag, while a malformed/missing result may
            // have queued it for an immediate canonical retry.
            const pendingBadgeCampaigns = getPendingBadgeCampaigns()
            if (pendingBadgeCampaigns.length > 0) {
                const batch = await claimAndSettlePendingBadgeCampaigns(pendingBadgeCampaigns)
                const confirmed = batch.claims.filter(isConfirmedBadgeCampaignClaim)
                const unavailable = batch.claims.filter(isUnavailableBadgeCampaignClaim)

                // Explicit badge campaigns do not pass through `/invites/accept`.
                // Shhhhh owns the one remaining compatibility continuation: only a
                // confirmed Skip Pass replaces its safe /home marker with /card.
                // Bespoke campaign destinations retired with TASK-21226.
                settleShhhhhCampaignContinuation(batch.claims)

                if (confirmed.length > 0) {
                    posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPTED, {
                        campaign_tag: confirmed[0]?.badgeCampaign,
                        campaign_tags: confirmed.map((claim) => claim.badgeCampaign),
                        badge_codes: confirmed.map((claim) => claim.badgeCode).filter(Boolean),
                    })
                }
                if (unavailable.length > 0) {
                    // Pre-joined into ONE string on purpose. Sentry's console
                    // integration serializes each console argument, and an array
                    // of objects lands in the issue as the literal "[Object]" —
                    // so the campaign and the reason, the only two facts worth
                    // logging, were both unreadable in production. Keep the
                    // message itself constant so Sentry still groups these
                    // together instead of opening a new issue per campaign.
                    console.warn(
                        'Campaign unavailable during registration',
                        unavailable.map(({ badgeCampaign, outcome }) => `${badgeCampaign}=${outcome}`).join(', ')
                    )
                }
                if (batch.pending.length > 0) {
                    captureException(new Error('register-time campaign claim retained for retry'), {
                        tags: { error_type: 'campaign_claim_retryable' },
                        extra: { pendingCampaigns: batch.pending, claims: batch.claims },
                    })
                }
            }

            setWebAuthnKey(webAuthnKey)
            saveToCookie(WEB_AUTHN_COOKIE_KEY, webAuthnKey, 90)
        } catch (e) {
            if ((e as Error).message.includes('pending')) {
                // the concurrent-request bail must still release the button
                dispatch(zerodevActions.setIsRegistering(false))
                return
            }
            const err = e as Error
            console.error('[useZeroDev] registration failed:', err.name, err.message, err, {
                shimInstalled: isPasskeyShimInstalled(),
            })
            if (isCeremonyGuardError(err)) {
                captureCeremonyGuardError(err, 'register')
            }
            dispatch(zerodevActions.setIsRegistering(false))
            throw e
        }
    }

    // login function
    const handleLogin = async () => {
        dispatch(zerodevActions.setIsLoggingIn(true))
        const ceremonyStartedAt = Date.now()
        try {
            const passkeyServerHeaders: Record<string, string> = {}

            if (user?.user?.username) {
                passkeyServerHeaders['x-username'] = user.user.username
            }

            const rpId = isCapacitor() ? getNativeRpId() : window.location.hostname.replace(/^www\./, '')

            // TASK-21782: on native, gate on the shim being installed (a tap
            // racing autoShimWebAuthn runs the webview's raw WebAuthn, which
            // silently hangs in Capacitor) and bound the ceremony to 60s so a
            // never-settling toWebAuthnKey can't leave isLoggingIn true until
            // app kill. A late result is discarded and its verify token is not
            // captured (ceremony window closed) — see passkeyCeremony.utils.
            const webAuthnKey = await withCeremonyPurpose('login', () =>
                guardPasskeyCeremony(() =>
                    toWebAuthnKey({
                        passkeyName: '[]',
                        passkeyServerUrl: PASSKEY_SERVER_URL as string,
                        mode: WebAuthnMode.Login,
                        passkeyServerHeaders,
                        rpID: rpId,
                    })
                )
            )

            setWebAuthnKey(webAuthnKey)
            saveToCookie(WEB_AUTHN_COOKIE_KEY, webAuthnKey, 90)
        } catch (e) {
            const err = normalizePasskeyServerError(e)
            const { code, message } = classifyPasskeyError(err)
            dispatch(zerodevActions.setIsLoggingIn(false))
            // Ceremony guards and server/network failures: nothing was
            // authenticated, so keep any existing state (no clearAuthState) and
            // report with a discriminating tag — this is the telemetry that
            // tells us WHERE native logins hang.
            if (isCeremonyGuardError(err)) {
                captureCeremonyGuardError(err, 'login', { elapsedMs: Date.now() - ceremonyStartedAt })
            } else if (code === 'NETWORK') {
                captureException(err, { tags: { error_type: 'passkey_server_failure' } })
            } else if (code !== 'LOGIN_CANCELED') {
                console.error('Error logging in', err)
                await clearAuthState(user?.user.userId)
                captureException(err, { tags: { error_type: 'login_error' } })
            } else if (isCapacitor()) {
                // the native plugin maps ceremony failures (.failed/.notHandled) to the
                // same NotAllowedError as a user cancel — keep visibility without alerting.
                captureException(err, { level: 'warning', tags: { error_type: 'login_canceled_native' } })
            }
            throw new PasskeyError(message, code)
        }
    }

    const handleSendUserOpEncoded = useCallback(
        async (
            calls: UserOpEncodedParams[],
            chainId: string,
            // The kernel-migration noop relies on RECEIVING the bundle receipt
            // of a reverted userOp so it can verify migration state against
            // on-chain truth (kernelMigration.utils.ts). Payment flows must
            // instead FAIL a reverted op — throwing is the default.
            opts?: { returnRevertedReceipt?: boolean }
        ): Promise<{ userOpHash: Hash; receipt: TransactionReceipt | null }> => {
            // demo mode: simulated success, no chain.
            if (isDemoMode()) {
                await new Promise((resolve) => setTimeout(resolve, 600))
                return { userOpHash: DEMO_USEROP_HASH, receipt: null }
            }

            // Non-Arb chains (recover-funds) aren't pre-built — wait for lazy build.
            await ensureClientForChain(chainId)
            const client = getClientForChain(chainId)
            dispatch(zerodevActions.setIsSendingUserOp(true))

            let userOpHash: Hash
            try {
                userOpHash = await withCeremonyPurpose('user_op', async () =>
                    client.sendUserOperation({
                        account: client.account,
                        callData: await client.account!.encodeCalls(calls),
                    })
                )
            } catch (error) {
                console.error('Error sending UserOp:', error)
                capturePasskeySignFailure(error, 'send-user-op')

                // Detect stale webAuthnKey errors (AA24, wapk) and force a clean
                // re-auth. A stale session can't recover by retrying — the only
                // exit is logging out and back in, so surface the message AND
                // force the logout (showing the toast alone left users stuck in a
                // signed-in-but-broken state).
                if (isStaleKeyError(error)) {
                    console.error('Detected stale webAuthnKey error - session is invalid')
                    captureException(error, {
                        tags: { error_type: 'stale_webauthn_key' },
                        extra: {
                            errorMessage: String(error),
                            context: 'transaction_signing',
                            userId: user?.user.userId,
                        },
                    })
                    dispatch(zerodevActions.setIsSendingUserOp(false))
                    logoutUser()
                    throw createStaleSessionError(error)
                }

                dispatch(zerodevActions.setIsSendingUserOp(false))
                throw error
            }
            setLoadingState('Executing transaction')
            let userOpReceipt: Awaited<ReturnType<typeof client.waitForUserOperationReceipt>>
            try {
                userOpReceipt = await client.waitForUserOperationReceipt({
                    hash: userOpHash,
                })
            } catch (error) {
                console.error('Error waiting for UserOp receipt:', error)
                captureException(error)
                // Rescue via the shared helper (skips after a genuine 120s
                // timeout; captures telemetry). See rescueUserOpReceipt.
                const rescued = await rescueUserOpReceipt(client, userOpHash, error, 'zerodev-send')
                setLoadingState('Idle')
                dispatch(zerodevActions.setIsSendingUserOp(false))
                // A rescued-but-REVERTED op is a real revert, not a lost
                // receipt: returning a success-shaped result would send flows
                // down the userOpHash fallback and show a success screen for a
                // transfer that moved no funds.
                if (rescued && !rescued.success) {
                    if (opts?.returnRevertedReceipt) return { userOpHash, receipt: rescued.receipt }
                    throw new Error(`UserOperation reverted on-chain (userOpHash ${userOpHash})`)
                }
                return { userOpHash, receipt: rescued?.receipt ?? null }
            }

            setLoadingState('Idle')
            dispatch(zerodevActions.setIsSendingUserOp(false))

            // A mined-but-REVERTED userOp still carries a successful EntryPoint
            // bundle receipt — returning it here let downstream flows record a
            // reverted transfer as a successful payment (same trap the rescue
            // path above guards; caller-side isTxReverted checks the BUNDLE
            // status and cannot catch an inner revert). The migration noop
            // opts INTO receiving the receipt instead (contract documented in
            // kernelMigration.utils.ts).
            if (!userOpReceipt.success) {
                if (opts?.returnRevertedReceipt) return { userOpHash, receipt: userOpReceipt.receipt }
                throw new Error(`UserOperation reverted on-chain (userOpHash ${userOpHash})`)
            }

            return {
                userOpHash,
                receipt: userOpReceipt.receipt,
            }
        },
        [getClientForChain, ensureClientForChain, logoutUser]
    )

    return {
        isKernelClientReady,
        setIsKernelClientReady: (value: boolean) => dispatch(zerodevActions.setIsKernelClientReady(value)),
        isRegistering,
        setIsRegistering: (value: boolean) => dispatch(zerodevActions.setIsRegistering(value)),
        isLoggingIn,
        setIsLoggingIn: (value: boolean) => dispatch(zerodevActions.setIsLoggingIn(value)),
        isSendingUserOp,
        setIsSendingUserOp: (value: boolean) => dispatch(zerodevActions.setIsSendingUserOp(value)),
        handleRegister,
        handleLogin,
        handleSendUserOpEncoded,
        address,
    }
}

'use client'

import { PASSKEY_SERVER_URL } from '@/constants/zerodev.consts'
import { loadingStateContext } from '@/context/loadingStates.context'
import { useAuth } from '@/context/authContext'
import { useKernelClient } from '@/context/kernelClient.context'
import { useAppDispatch, useSetupStore, useZerodevStore } from '@/redux/hooks'
import { zerodevActions } from '@/redux/slices/zerodev-slice'
import { getFromCookie, removeFromCookie, saveToCookie } from '@/utils/general.utils'
import { clearAuthState } from '@/utils/auth.utils'
import { isStaleKeyError, createStaleSessionError } from '@/utils/walletCredential.utils'
import { capturePasskeySignFailure, classifyPasskeyError } from '@/utils/webauthn.utils'
import { toWebAuthnKey, WebAuthnMode } from '@zerodev/passkey-validator'
import { useCallback, useContext } from 'react'
import type { TransactionReceipt, Hex, Hash } from 'viem'
import { captureException } from '@sentry/nextjs'
import { invitesApi } from '@/services/invites'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { isCapacitor, getNativeRpId } from '@/utils/capacitor'
import { isDemoMode } from '@/utils/demo'

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

const WEB_AUTHN_COOKIE_KEY = 'web-authn-key'

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
            const webAuthnKey = await toWebAuthnKey({
                passkeyName: _getPasskeyName(username),
                passkeyServerUrl: PASSKEY_SERVER_URL as string,
                mode: WebAuthnMode.Register,
                passkeyServerHeaders: {},
                rpID: rpId,
            })

            const inviteCodeFromCookie = getFromCookie('inviteCode')

            // invite code can also be store in cookies, so we need to check both
            const userInviteCode = inviteCode || inviteCodeFromCookie
            const campaignTag = getFromCookie('campaignTag')

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
                try {
                    const result = await invitesApi.acceptInvite(userInviteCode, inviteType, campaignTag)
                    if (result.success) {
                        posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPTED, {
                            invite_code: userInviteCode,
                            invite_type: inviteType,
                            campaign_tag: campaignTag,
                        })
                        if (inviteCodeFromCookie) {
                            removeFromCookie('inviteCode')
                        }
                        if (campaignTag) {
                            removeFromCookie('campaignTag')
                        }
                    } else {
                        posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, {
                            invite_code: userInviteCode,
                            error_message: 'API returned unsuccessful',
                        })
                        captureException(new Error('register-time invite accept returned unsuccessful'), {
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
            } else if (campaignTag) {
                // No invite code but a campaign tag — only InvitesPage's skip-path
                // CTA reaches here today (it sets the cookie without an inviteCode).
                // The BE whitelists which campaigns are claimable, so passing other
                // values through is safe — anything not on the whitelist 400s.
                try {
                    await invitesApi.awardBadge(campaignTag)
                    posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPTED, { campaign_tag: campaignTag })
                } catch (e) {
                    console.error('Error awarding campaign badge', e)
                } finally {
                    removeFromCookie('campaignTag')
                }
            }

            setWebAuthnKey(webAuthnKey)
            saveToCookie(WEB_AUTHN_COOKIE_KEY, webAuthnKey, 90)
        } catch (e) {
            if ((e as Error).message.includes('pending')) {
                return
            }
            const err = e as Error
            console.error('[useZeroDev] registration failed:', err.name, err.message, err)
            console.error('[useZeroDev] shim installed:', (globalThis as any).__capgoPasskeyShimInstalled)
            dispatch(zerodevActions.setIsRegistering(false))
            throw e
        }
    }

    // login function
    const handleLogin = async () => {
        dispatch(zerodevActions.setIsLoggingIn(true))
        try {
            const passkeyServerHeaders: Record<string, string> = {}

            if (user?.user?.username) {
                passkeyServerHeaders['x-username'] = user.user.username
            }

            const rpId = isCapacitor() ? getNativeRpId() : window.location.hostname.replace(/^www\./, '')

            const webAuthnKey = await toWebAuthnKey({
                passkeyName: '[]',
                passkeyServerUrl: PASSKEY_SERVER_URL as string,
                mode: WebAuthnMode.Login,
                passkeyServerHeaders,
                rpID: rpId,
            })

            setWebAuthnKey(webAuthnKey)
            saveToCookie(WEB_AUTHN_COOKIE_KEY, webAuthnKey, 90)
        } catch (e) {
            const { code, message } = classifyPasskeyError(e)
            dispatch(zerodevActions.setIsLoggingIn(false))
            // Cancel saved no state; everything else clears stale state and reports the raw error to Sentry.
            if (code !== 'LOGIN_CANCELED') {
                console.error('Error logging in', e)
                clearAuthState(user?.user.userId)
                captureException(e, { tags: { error_type: 'login_error' } })
            }
            throw new PasskeyError(message, code)
        }
    }

    const handleSendUserOpEncoded = useCallback(
        async (
            calls: UserOpEncodedParams[],
            chainId: string
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
                userOpHash = await client.sendUserOperation({
                    account: client.account,
                    callData: await client.account!.encodeCalls(calls),
                })
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
                dispatch(zerodevActions.setIsSendingUserOp(false))
                return {
                    userOpHash,
                    receipt: null,
                }
            }

            setLoadingState('Idle')
            dispatch(zerodevActions.setIsSendingUserOp(false))

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

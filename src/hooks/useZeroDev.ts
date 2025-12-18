'use client'

import * as consts from '@/constants/zerodev.consts'
import { loadingStateContext } from '@/context'
import { useAuth } from '@/context/authContext'
import { useKernelClient } from '@/context/kernelClient.context'
import { useAppDispatch, useSetupStore, useZerodevStore } from '@/redux/hooks'
import { zerodevActions } from '@/redux/slices/zerodev-slice'
import { getFromCookie, removeFromCookie, saveToCookie, clearAuthState } from '@/utils'
import { toWebAuthnKey, WebAuthnMode } from '@zerodev/passkey-validator'
import { useCallback, useContext } from 'react'
import type { TransactionReceipt, Hex, Hash } from 'viem'
import { captureException } from '@sentry/nextjs'
import { invitesApi } from '@/services/invites'
import { keccak256 } from 'viem'

// types
type UserOpEncodedParams = {
    to: Hex
    value?: bigint | undefined
    data?: Hex | undefined
}

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

/**
 * Detects if an error is due to stale/invalid webAuthnKey
 * AA24 = EntryPoint signature verification failed
 * wapk = WebAuthn Public Key unauthorized (ZeroDev-specific)
 *
 * Note: Intentionally strict to avoid false positives on generic auth errors
 */
const isStaleKeyError = (error: unknown): boolean => {
    const errorStr = String(error).toLowerCase()
    // AA24 = ERC-4337 EntryPoint signature verification failed
    // wapk + unauthorized = ZeroDev's specific WebAuthn key error (not generic 401)
    return errorStr.includes('aa24') || (errorStr.includes('wapk') && errorStr.includes('unauthorized'))
}

/**
 * helper to convert base64url to hex string
 */
const b64ToBytes = (base64: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4)
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(b64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

const uint8ArrayToHexString = (arr: Uint8Array): `0x${string}` => {
    return `0x${Array.from(arr)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`
}

/**
 * custom login function that supports legacyMode for passkey recovery
 * this is needed because toWebAuthnKey doesn't support custom parameters
 */
const loginWithLegacyMode = async (
    passkeyServerUrl: string,
    rpID: string,
    passkeyServerHeaders: Record<string, string> = {}
): Promise<Awaited<ReturnType<typeof toWebAuthnKey>>> => {
    console.log('[useZeroDev] Attempting legacy mode login for passkey recovery')

    // 1. get login options with legacyMode enabled
    const optionsResponse = await fetch(`${passkeyServerUrl}/login/options`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...passkeyServerHeaders,
        },
        body: JSON.stringify({ rpID, legacyMode: true }),
        credentials: 'include',
    })
    const options = await optionsResponse.json()

    // 2. start authentication with the browser
    const { startAuthentication } = await import('@simplewebauthn/browser')
    const credential = await startAuthentication(options)

    // 3. verify the credential
    const verifyResponse = await fetch(`${passkeyServerUrl}/login/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...passkeyServerHeaders,
        },
        body: JSON.stringify({ cred: credential, rpID }),
        credentials: 'include',
    })
    const verifyResult = await verifyResponse.json()

    if (!verifyResult.verification?.verified) {
        throw new Error('Legacy login verification failed')
    }

    // 4. extract public key and build WebAuthnKey object
    // the server returns pubkey in base64 SPKI format - decode to Uint8Array
    const spkiBase64 = verifyResult.pubkey as string
    const spkiDer = Uint8Array.from(atob(spkiBase64), (c) => c.charCodeAt(0))

    const key = await crypto.subtle.importKey('spki', spkiDer, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify'])

    // export to raw format to get x,y coordinates
    const rawKey = await crypto.subtle.exportKey('raw', key)
    const rawKeyArray = new Uint8Array(rawKey)

    // first byte is 0x04 (uncompressed), followed by x and y (32 bytes each)
    const pubKeyX = Array.from(rawKeyArray.subarray(1, 33))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    const pubKeyY = Array.from(rawKeyArray.subarray(33))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

    const authenticatorIdHash = keccak256(uint8ArrayToHexString(b64ToBytes(credential.id)))

    console.log('[useZeroDev] Legacy mode login successful')

    return {
        pubX: BigInt(`0x${pubKeyX}`),
        pubY: BigInt(`0x${pubKeyY}`),
        authenticatorId: credential.id,
        authenticatorIdHash,
        rpID: '',
    }
}

export const useZeroDev = () => {
    const dispatch = useAppDispatch()
    const { user } = useAuth()
    const { isKernelClientReady, isRegistering, isLoggingIn, isSendingUserOp, address } = useZerodevStore()
    const { setWebAuthnKey, getClientForChain } = useKernelClient()
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
            const webAuthnKey = await toWebAuthnKey({
                passkeyName: _getPasskeyName(username),
                passkeyServerUrl: consts.PASSKEY_SERVER_URL as string,
                mode: WebAuthnMode.Register,
                passkeyServerHeaders: {},
                rpID: window.location.hostname.replace(/^www\./, ''),
            })

            const inviteCodeFromCookie = getFromCookie('inviteCode')

            // invite code can also be store in cookies, so we need to check both
            const userInviteCode = inviteCode || inviteCodeFromCookie
            const campaignTag = getFromCookie('campaignTag')

            if (userInviteCode?.trim().length > 0) {
                try {
                    const result = await invitesApi.acceptInvite(userInviteCode, inviteType, campaignTag)
                    if (!result.success) {
                        console.error('Error accepting invite', result)
                    }
                    if (inviteCodeFromCookie) {
                        removeFromCookie('inviteCode')
                    }
                    if (campaignTag) {
                        removeFromCookie('campaignTag')
                    }
                } catch (e) {
                    console.error('Error accepting invite', e)
                }
            }

            setWebAuthnKey(webAuthnKey)
            saveToCookie(WEB_AUTHN_COOKIE_KEY, webAuthnKey, 90)
        } catch (e) {
            if ((e as Error).message.includes('pending')) {
                return
            }
            console.error('Error registering passkey', e)
            dispatch(zerodevActions.setIsRegistering(false))
            throw e
        }
    }

    // login function with automatic legacy mode fallback for passkey recovery
    const handleLogin = async () => {
        dispatch(zerodevActions.setIsLoggingIn(true))

        // compute rpID - must be hostname only (no protocol, no www prefix)
        const rpID = window.location.hostname.replace(/^www\./, '')
        console.log('[useZeroDev] Login rpID:', rpID, 'hostname:', window.location.hostname)

        const passkeyServerHeaders: Record<string, string> = {}
        if (user?.user?.username) {
            passkeyServerHeaders['x-username'] = user.user.username
        }

        // try normal login first
        try {
            const webAuthnKey = await toWebAuthnKey({
                passkeyName: '[]',
                passkeyServerUrl: consts.PASSKEY_SERVER_URL as string,
                mode: WebAuthnMode.Login,
                passkeyServerHeaders,
                rpID,
            })

            setWebAuthnKey(webAuthnKey)
            saveToCookie(WEB_AUTHN_COOKIE_KEY, webAuthnKey, 90)
            return
        } catch (normalError) {
            const error = normalError as Error

            // if NotAllowedError, try legacy mode (for users who registered with buggy rpID)
            if (error.name === 'NotAllowedError') {
                console.log('[useZeroDev] Normal login failed, trying legacy mode for passkey recovery')

                try {
                    const webAuthnKey = await loginWithLegacyMode(
                        consts.PASSKEY_SERVER_URL as string,
                        rpID,
                        passkeyServerHeaders
                    )

                    // legacy mode worked! log for monitoring
                    console.log('[useZeroDev] Legacy mode login successful - user had legacy rpID passkey')
                    captureException(new Error('Legacy passkey login used'), {
                        level: 'info',
                        tags: { passkey_recovery: 'legacy_rpid' },
                    })

                    setWebAuthnKey(webAuthnKey)
                    saveToCookie(WEB_AUTHN_COOKIE_KEY, webAuthnKey, 90)
                    return
                } catch (legacyError) {
                    // legacy mode also failed - user either cancelled or truly has no passkey
                    console.log('[useZeroDev] Legacy mode also failed:', (legacyError as Error).message)

                    // check if user cancelled the legacy attempt too
                    if ((legacyError as Error).name === 'NotAllowedError') {
                        dispatch(zerodevActions.setIsLoggingIn(false))
                        throw new PasskeyError(
                            'Login was canceled or no passkey found. Please try again or register.',
                            'LOGIN_CANCELED'
                        )
                    }

                    // other error in legacy mode
                    console.error('Error in legacy login', legacyError)
                    clearAuthState(user?.user.userId)
                    captureException(legacyError, { tags: { error_type: 'legacy_login_error' } })
                    dispatch(zerodevActions.setIsLoggingIn(false))
                    throw new PasskeyError('An unexpected error occurred during login.', 'LOGIN_ERROR')
                }
            }

            // non-NotAllowedError - clear stale state and throw
            console.error('Error logging in', normalError)
            clearAuthState(user?.user.userId)
            captureException(normalError, { tags: { error_type: 'login_error' } })
            dispatch(zerodevActions.setIsLoggingIn(false))
            throw new PasskeyError('An unexpected error occurred during login.', 'LOGIN_ERROR')
        }
    }

    const handleSendUserOpEncoded = useCallback(
        async (
            calls: UserOpEncodedParams[],
            chainId: string
        ): Promise<{ userOpHash: Hash; receipt: TransactionReceipt | null }> => {
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

                // Detect stale webAuthnKey errors (AA24, wapk) and provide user feedback
                // NOTE: Don't auto-clear here - user is mid-transaction, avoid data loss
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
                    // Enhance error message for user feedback
                    const enhancedError = new Error(
                        'Your session has expired. Please refresh the page and log in again.'
                    )
                    ;(enhancedError as any).cause = error
                    ;(enhancedError as any).isStaleKeyError = true
                    dispatch(zerodevActions.setIsSendingUserOp(false))
                    throw enhancedError
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
        [getClientForChain]
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

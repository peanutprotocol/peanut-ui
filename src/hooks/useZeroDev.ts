'use client'

import * as consts from '@/constants/zerodev.consts'
import { loadingStateContext } from '@/context'
import { useAuth } from '@/context/authContext'
import { useKernelClient } from '@/context/kernelClient.context'
import { useAppDispatch, useZerodevStore } from '@/redux/hooks'
import { zerodevActions } from '@/redux/slices/zerodev-slice'
import { saveToLocalStorage } from '@/utils'
import { toWebAuthnKey, WebAuthnMode } from '@zerodev/passkey-validator'
import { useCallback, useContext } from 'react'
import type { TransactionReceipt } from 'viem'
import { Hex } from 'viem'

// types
type UserOpEncodedParams = {
    to: Hex
    value?: bigint | undefined
    data?: Hex | undefined
}

const LOCAL_STORAGE_WEB_AUTHN_KEY = 'web-authn-key'

// Custom error for when no passkey is registered
export class NoPasskeyRegisteredError extends Error {
    constructor(message?: string) {
        super(message || 'No passkey registered for this device.')
        this.name = 'NoPasskeyRegisteredError'
    }
}

// helper to generate a random challenge for WebAuthn
function generateRandomChallenge(): ArrayBuffer {
    const buffer = new Uint8Array(32)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(buffer)
    } else {
        // fallback for environments where crypto.getRandomValues might not be available
        for (let i = 0; i < buffer.length; i++) buffer[i] = Math.floor(Math.random() * 256)
    }
    return buffer.buffer
}

const CONDITIONAL_MEDIATION_MANUAL_TIMEOUT_MS = 7000 // A bit longer than the internal timeout

// Store the AbortController globally or in a way that persists across calls if needed,
// though for this specific use case, a new controller per call is fine as we race it.
// If we wanted to explicitly abort a *previous* checkPasskeyExists call, we'd need to manage its controller.

// helper to check if a passkey exists using conditional mediation
async function checkPasskeyExists(rpId: string): Promise<boolean> {
    console.log(
        `[useZeroDev] checkPasskeyExists: Starting for rpId: ${rpId}. Manual timeout: ${CONDITIONAL_MEDIATION_MANUAL_TIMEOUT_MS}ms`
    )
    if (
        typeof window === 'undefined' ||
        !window.navigator ||
        !window.navigator.credentials ||
        typeof window.navigator.credentials.get !== 'function'
    ) {
        console.warn('[useZeroDev] checkPasskeyExists: WebAuthn API not available. Skipping pre-check.')
        return true // Assume passkey might exist if API is not available
    }

    const controller = new AbortController()
    const signal = controller.signal

    try {
        const conditionalGetPromise = navigator.credentials.get({
            mediation: 'conditional',
            publicKey: {
                challenge: generateRandomChallenge(),
                rpId: rpId,
                userVerification: 'discouraged',
                timeout: 5000, // Browser-internal timeout for the call itself
            },
            signal: signal, // Pass the abort signal to the API
        })

        // Attach a catch handler to conditionalGetPromise to prevent unhandled rejection
        // when we abort it via the controller. We don't need to do much here as the
        // Promise.race logic will handle the timeout case.
        conditionalGetPromise.catch((error) => {
            if (error.name === 'AbortError') {
                console.info(
                    '[useZeroDev] checkPasskeyExists: conditionalGetPromise aborted as expected (likely due to timeout).'
                )
            } else {
                // This should ideally not be hit if Promise.race's catch handles other errors first,
                // but it's a safeguard.
                console.warn(
                    '[useZeroDev] checkPasskeyExists: conditionalGetPromise rejected with an unexpected error:',
                    error
                )
            }
        })

        const timeoutPromise = new Promise<null>((resolve) => {
            const timer = setTimeout(() => {
                console.warn(
                    `[useZeroDev] checkPasskeyExists: Manual timeout triggered after ${CONDITIONAL_MEDIATION_MANUAL_TIMEOUT_MS}ms. Aborting conditionalGet.`
                )
                if (!signal.aborted) {
                    // Check if not already aborted
                    controller.abort()
                }
                resolve(null)
            }, CONDITIONAL_MEDIATION_MANUAL_TIMEOUT_MS)
            // Clear timeout if conditionalGetPromise resolves/rejects first
            conditionalGetPromise.finally(() => clearTimeout(timer))
        })

        console.log('[useZeroDev] checkPasskeyExists: Racing navigator.credentials.get against manual timeout.')
        const result = await Promise.race([conditionalGetPromise, timeoutPromise])

        if (result === null) {
            console.warn(
                `[useZeroDev] checkPasskeyExists: Result is null (likely manual timeout led to abort). Assuming no passkey found.`
            )
            return false
        }

        console.log('[useZeroDev] checkPasskeyExists: Conditional mediation result - credential present:', !!result)
        return !!result // If result is a credential object, it's truthy.
    } catch (error: any) {
        // This catch block is for errors from Promise.race itself, or if conditionalGetPromise
        // rejects with something *other* than AbortError before the timeout (and wasn't caught by its own .catch).
        if (error.name === 'AbortError') {
            // This case should ideally be less common now that conditionalGetPromise has its own catch for AbortError.
            console.info('[useZeroDev] checkPasskeyExists: Promise.race caught AbortError. Assuming no passkey.')
            return false
        } else if (
            error.name === 'OperationError' &&
            error.message &&
            error.message.toLowerCase().includes('pending')
        ) {
            console.warn(
                '[useZeroDev] checkPasskeyExists: Detected an already pending WebAuthn operation. Skipping pre-check and allowing main login attempt.',
                error
            )
            return true // Allow main login to proceed if a request is already pending
        } else {
            console.info(
                '[useZeroDev] checkPasskeyExists: Promise.race or conditionalGetPromise threw an unexpected error. Assuming no passkey:',
                error
            )
            return false
        }
    }
}

export const useZeroDev = () => {
    const dispatch = useAppDispatch()
    const { user } = useAuth()
    const { isKernelClientReady, isRegistering, isLoggingIn, isSendingUserOp, address } = useZerodevStore()
    const { setWebAuthnKey, getClientForChain } = useKernelClient()
    const { setLoadingState } = useContext(loadingStateContext)

    // Future note: could be `${username}.${process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIM || 'peanut.me'}` (have to change BE too)
    const _getPasskeyName = (username: string) => `${username}.peanut.wallet`

    // register function
    const handleRegister = async (username: string): Promise<void> => {
        console.log('[useZeroDev] handleRegister: Attempting to register username:', username)
        dispatch(zerodevActions.setIsRegistering(true))
        try {
            const webAuthnKey = await toWebAuthnKey({
                passkeyName: _getPasskeyName(username),
                passkeyServerUrl: consts.PASSKEY_SERVER_URL as string,
                mode: WebAuthnMode.Register,
                passkeyServerHeaders: {},
                rpID: window.location.hostname.replace(/^www\./, ''),
            })
            console.log('[useZeroDev] handleRegister: WebAuthnKey generation successful.')
            setWebAuthnKey(webAuthnKey)
            saveToLocalStorage(LOCAL_STORAGE_WEB_AUTHN_KEY, webAuthnKey)
        } catch (e) {
            console.error('[useZeroDev] handleRegister: Error during registration process.', e)
            if ((e as Error).message.includes('pending')) {
                console.log('[useZeroDev] handleRegister: Registration is pending, returning.')
                return
            }
            throw e
        } finally {
            console.log('[useZeroDev] handleRegister: Finalizing registration attempt.')
            dispatch(zerodevActions.setIsRegistering(false))
        }
    }

    // login function
    const handleLogin = async () => {
        console.log('[useZeroDev] handleLogin: Initiating login process.')
        dispatch(zerodevActions.setIsLoggingIn(true))
        // Reverted to dynamic RP ID based on hostname for correct local/prod behavior
        const currentRpId = window.location.hostname.replace(/^www\./, '')
        console.log('[useZeroDev] handleLogin: RP ID:', currentRpId)

        try {
            console.log('[useZeroDev] handleLogin: About to call checkPasskeyExists.')
            const passkeyAvailable = await checkPasskeyExists(currentRpId)
            console.log('[useZeroDev] handleLogin: checkPasskeyExists result - passkeyAvailable:', passkeyAvailable)

            if (!passkeyAvailable) {
                console.warn(
                    '[useZeroDev] handleLogin: No passkey available based on pre-check (or pre-check explicitly determined no passkey). Throwing NoPasskeyRegisteredError.'
                )
                throw new NoPasskeyRegisteredError('No passkey found for this website. Please create an account first.')
            }

            console.log(
                '[useZeroDev] handleLogin: Passkey pre-check indicates availability or was skipped due to pending op. Proceeding with full toWebAuthnKey for login.'
            )
            const passkeyServerHeaders: Record<string, string> = {}
            if (user?.user?.username) {
                passkeyServerHeaders['x-username'] = user.user.username
                console.log('[useZeroDev] handleLogin: Added x-username header:', user.user.username)
            }

            const webAuthnKey = await toWebAuthnKey({
                passkeyName: '[]',
                passkeyServerUrl: consts.PASSKEY_SERVER_URL as string,
                mode: WebAuthnMode.Login,
                passkeyServerHeaders,
                rpID: currentRpId,
            })
            console.log('[useZeroDev] handleLogin: toWebAuthnKey call successful. WebAuthnKey obtained.')

            setWebAuthnKey(webAuthnKey)
            saveToLocalStorage(LOCAL_STORAGE_WEB_AUTHN_KEY, webAuthnKey)
            console.log(
                '[useZeroDev] handleLogin: WebAuthnKey set and saved to local storage. Login attempt successful from hook perspective.'
            )
        } catch (e) {
            console.error('[useZeroDev] handleLogin: Error during login process.', e)
            if (e instanceof NoPasskeyRegisteredError) {
                console.log('[useZeroDev] handleLogin: Caught NoPasskeyRegisteredError. Re-throwing.')
            } else {
                console.log(
                    '[useZeroDev] handleLogin: Caught a generic error during login (could be from toWebAuthnKey). Re-throwing.'
                )
            }
            throw e
        } finally {
            console.log(
                '[useZeroDev] handleLogin: Finalizing login attempt in finally block, setting isLoggingIn to false.'
            )
            dispatch(zerodevActions.setIsLoggingIn(false))
        }
    }

    const handleSendUserOpEncoded = useCallback(
        async (calls: UserOpEncodedParams[], chainId: string): Promise<TransactionReceipt> => {
            const client = getClientForChain(chainId)
            dispatch(zerodevActions.setIsSendingUserOp(true))

            try {
                const userOpHash = await client.sendUserOperation({
                    account: client.account,
                    callData: await client.account!.encodeCalls(calls),
                })

                setLoadingState('Executing transaction')
                const receipt = await client.waitForUserOperationReceipt({
                    hash: userOpHash,
                })

                setLoadingState('Idle')
                dispatch(zerodevActions.setIsSendingUserOp(false))

                return receipt.receipt
            } catch (error) {
                console.error('Error sending encoded UserOp:', error)
                dispatch(zerodevActions.setIsSendingUserOp(false))
                throw error
            }
        },
        [getClientForChain, dispatch, setLoadingState]
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

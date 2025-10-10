'use client'

import * as consts from '@/constants/zerodev.consts'
import { loadingStateContext } from '@/context'
import { useAuth } from '@/context/authContext'
import { useKernelClient } from '@/context/kernelClient.context'
import { useAppDispatch, useSetupStore, useZerodevStore } from '@/redux/hooks'
import { zerodevActions } from '@/redux/slices/zerodev-slice'
import { getFromCookie, removeFromCookie, saveToCookie, saveToLocalStorage } from '@/utils'
import { toWebAuthnKey, WebAuthnMode } from '@zerodev/passkey-validator'
import { useCallback, useContext } from 'react'
import type { TransactionReceipt, Hex, Hash } from 'viem'
import { captureException } from '@sentry/nextjs'
import { invitesApi } from '@/services/invites'

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

const LOCAL_STORAGE_WEB_AUTHN_KEY = 'web-authn-key'

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

            if (userInviteCode?.trim().length > 0) {
                try {
                    const result = await invitesApi.acceptInvite(userInviteCode, inviteType)
                    if (!result.success) {
                        console.error('Error accepting invite', result)
                    }
                    if (inviteCodeFromCookie) {
                        removeFromCookie('inviteCode')
                    }
                } catch (e) {
                    console.error('Error accepting invite', e)
                }
            }

            setWebAuthnKey(webAuthnKey)
            saveToLocalStorage(LOCAL_STORAGE_WEB_AUTHN_KEY, webAuthnKey)
            saveToCookie(LOCAL_STORAGE_WEB_AUTHN_KEY, webAuthnKey, 90)
        } catch (e) {
            if ((e as Error).message.includes('pending')) {
                return
            }
            console.error('Error registering passkey', e)
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

            const webAuthnKey = await toWebAuthnKey({
                passkeyName: '[]',
                passkeyServerUrl: consts.PASSKEY_SERVER_URL as string,
                mode: WebAuthnMode.Login,
                passkeyServerHeaders,
                rpID: window.location.hostname.replace(/^www\./, ''),
            })

            setWebAuthnKey(webAuthnKey)
            saveToLocalStorage(LOCAL_STORAGE_WEB_AUTHN_KEY, webAuthnKey)
            saveToCookie(LOCAL_STORAGE_WEB_AUTHN_KEY, webAuthnKey, 90)
        } catch (e) {
            const error = e as Error
            if (error.name === 'NotAllowedError') {
                dispatch(zerodevActions.setIsLoggingIn(false))
                throw new PasskeyError(
                    'Login was canceled or no passkey found. Please try again or register.',
                    'LOGIN_CANCELED'
                )
            }
            console.error('Error logging in', e)
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

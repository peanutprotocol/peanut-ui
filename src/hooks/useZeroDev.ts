'use client'

import * as consts from '@/constants/zerodev.consts'
import { loadingStateContext } from '@/context'
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
    const { isKernelClientReady, isRegistering, isLoggingIn, isSendingUserOp, address } = useZerodevStore()
    const { setWebAuthnKey, getClientForChain } = useKernelClient()
    const { setLoadingState } = useContext(loadingStateContext)

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

            setWebAuthnKey(webAuthnKey)
            saveToLocalStorage(LOCAL_STORAGE_WEB_AUTHN_KEY, webAuthnKey)
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

            const webAuthnKey = await toWebAuthnKey({
                passkeyName: '', // empty to let browser handle selection
                passkeyServerUrl: consts.PASSKEY_SERVER_URL as string,
                mode: WebAuthnMode.Login,
                passkeyServerHeaders,
                rpID: window.location.hostname.replace(/^www\./, ''),
            })

            setWebAuthnKey(webAuthnKey)
            saveToLocalStorage(LOCAL_STORAGE_WEB_AUTHN_KEY, webAuthnKey)
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

'use client'

import * as consts from '@/constants/zerodev.consts'
import { useAuth } from '@/context/authContext'
import { useKernelClient } from '@/context/kernelClient.context'
import { useAppDispatch, useZerodevStore } from '@/redux/hooks'
import { zerodevActions } from '@/redux/slices/zerodev-slice'
import { saveToLocalStorage } from '@/utils'
import { toWebAuthnKey, WebAuthnMode } from '@zerodev/passkey-validator'
import { useCallback } from 'react'
import { Abi, Address, encodeFunctionData, Hex } from 'viem'

// types
type UserOpNotEncodedParams = {
    to: Address
    value: number
    abi: Abi
    functionName: string
    args: any[]
}
type UserOpEncodedParams = {
    to: Hex
    value?: bigint | undefined
    data?: Hex | undefined
}

const LOCAL_STORAGE_WEB_AUTHN_KEY = 'web-authn-key'

export const useZeroDev = () => {
    const dispatch = useAppDispatch()
    const { user } = useAuth()
    const { isKernelClientReady, isRegistering, isLoggingIn, isSendingUserOp, address } = useZerodevStore()
    const { kernelClient, setWebAuthnKey } = useKernelClient()

    const _getPasskeyName = (handle: string) => `${handle}.peanut.wallet`

    // register function
    const handleRegister = async (handle: string): Promise<void> => {
        dispatch(zerodevActions.setIsRegistering(true))
        try {
            const webAuthnKey = await toWebAuthnKey({
                passkeyName: _getPasskeyName(handle),
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
        } catch (e) {
            console.error('Error logging in', e)
            dispatch(zerodevActions.setIsLoggingIn(false))
            throw e
        }
    }

    // UserOp functions
    const handleSendUserOpEncoded = useCallback(
        async (calls: UserOpEncodedParams[]) => {
            if (!kernelClient) {
                throw new Error('Trying to send user operation before client initialization')
            }
            dispatch(zerodevActions.setIsSendingUserOp(true))

            try {
                const userOpHash = await kernelClient.sendUserOperation({
                    account: kernelClient.account,
                    callData: await kernelClient.account!.encodeCalls(calls),
                })

                const receipt = await kernelClient.waitForUserOperationReceipt({
                    hash: userOpHash,
                })

                console.log('UserOp completed:', `https://jiffyscan.xyz/userOpHash/${userOpHash}?network=sepolia`)
                dispatch(zerodevActions.setIsSendingUserOp(false))

                return receipt.receipt.transactionHash
            } catch (error) {
                console.error('Error sending encoded UserOp:', error)
                dispatch(zerodevActions.setIsSendingUserOp(false))
                throw error
            }
        },
        [kernelClient, dispatch]
    )

    const handleSendUserOpNotEncoded = useCallback(
        async ({ to, value, abi, functionName, args }: UserOpNotEncodedParams) => {
            if (!kernelClient?.account) {
                throw new Error('Kernel client or account not initialized')
            }

            dispatch(zerodevActions.setIsSendingUserOp(true))

            try {
                const userOpHash = await kernelClient.sendUserOperation({
                    account: kernelClient.account,
                    callData: await kernelClient.account.encodeCalls([
                        {
                            to,
                            value: BigInt(value),
                            data: encodeFunctionData({
                                abi,
                                functionName,
                                args,
                            }),
                        },
                    ]),
                })

                await kernelClient.waitForUserOperationReceipt({
                    hash: userOpHash,
                })

                console.log('UserOp completed:', `https://jiffyscan.xyz/userOpHash/${userOpHash}?network=sepolia`)
                dispatch(zerodevActions.setIsSendingUserOp(false))

                return userOpHash
            } catch (error) {
                console.error('Error sending not encoded UserOp:', error)
                dispatch(zerodevActions.setIsSendingUserOp(false))
                throw error
            }
        },
        [kernelClient, dispatch]
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
        handleSendUserOpNotEncoded,
        address,
    }
}

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
    const { setWebAuthnKey, getClientForChain } = useKernelClient()

    // Future note: could be `${handle}.${process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIM || 'peanut.me'}` (have to change BE too)
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

    const handleSendUserOpEncoded = useCallback(
        async (calls: UserOpEncodedParams[], chainId: string) => {
            const client = getClientForChain(chainId)
            dispatch(zerodevActions.setIsSendingUserOp(true))

            try {
                const userOpHash = await client.sendUserOperation({
                    account: client.account,
                    callData: await client.account!.encodeCalls(calls),
                })

                const receipt = await client.waitForUserOperationReceipt({
                    hash: userOpHash,
                })

                dispatch(zerodevActions.setIsSendingUserOp(false))

                return receipt.receipt.transactionHash
            } catch (error) {
                console.error('Error sending encoded UserOp:', error)
                dispatch(zerodevActions.setIsSendingUserOp(false))
                throw error
            }
        },
        [getClientForChain]
    )

    const handleSendUserOpNotEncoded = useCallback(
        async ({ to, value, abi, functionName, args }: UserOpNotEncodedParams, chainId: string) => {
            const client = getClientForChain(chainId)
            dispatch(zerodevActions.setIsSendingUserOp(true))
            const userOpHash = await client.sendUserOperation({
                account: client.account,
                callData: await client.account!.encodeCalls([
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
            await client.waitForUserOperationReceipt({
                hash: userOpHash,
            })
            dispatch(zerodevActions.setIsSendingUserOp(false))
            return userOpHash
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
        handleSendUserOpNotEncoded,
        address,
    }
}

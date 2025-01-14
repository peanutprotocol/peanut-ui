'use client'

import { peanutPublicClient } from '@/constants/viem.consts'
import * as consts from '@/constants/zerodev.consts'
import { useAuth } from '@/context/authContext'
import { useAppDispatch, useZerodevStore } from '@/redux/hooks'
import { zerodevActions } from '@/redux/slices/zerodev-slice'
import { getFromLocalStorage, saveToLocalStorage } from '@/utils'
import {
    PasskeyValidatorContractVersion,
    toPasskeyValidator,
    toWebAuthnKey,
    WebAuthnMode,
} from '@zerodev/passkey-validator'
import {
    createKernelAccount,
    createKernelAccountClient,
    createZeroDevPaymasterClient,
    KernelAccountClient,
} from '@zerodev/sdk'
import { KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { useCallback, useEffect, useState } from 'react'
import { Abi, Address, encodeFunctionData, Hex, http, Transport } from 'viem'

// types
type AppSmartAccountClient = KernelAccountClient<Transport, typeof consts.PEANUT_WALLET_CHAIN>
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

type WebAuthnKey = Awaited<ReturnType<typeof toWebAuthnKey>>

const LOCAL_STORAGE_WEB_AUTHN_KEY = 'web-authn-key'

export const useZeroDev = () => {
    const dispatch = useAppDispatch()
    const { fetchUser, user } = useAuth()
    const { isKernelClientReady, isRegistering, isLoggingIn, isSendingUserOp, address } = useZerodevStore()

    // local states for non-UI state
    const [kernelClient, setKernelClient] = useState<AppSmartAccountClient | undefined>(undefined)
    const [webAuthnKey, setWebAuthnKey] = useState<WebAuthnKey | undefined>(undefined)

    const _getPasskeyName = (handle: string) => `${handle}.peanut.wallet`

    // setup function
    const createKernelClient = async (passkeyValidator: any) => {
        console.log({ passkeyValidator })
        const kernelAccount = await createKernelAccount(peanutPublicClient, {
            plugins: {
                sudo: passkeyValidator,
            },
            entryPoint: consts.USER_OP_ENTRY_POINT,
            kernelVersion: KERNEL_V3_1,
        })

        const kernelClient = createKernelAccountClient({
            account: kernelAccount,
            chain: consts.PEANUT_WALLET_CHAIN,
            bundlerTransport: http(consts.BUNDLER_URL),
            paymaster: {
                getPaymasterData: async (userOperation) => {
                    const zerodevPaymaster = createZeroDevPaymasterClient({
                        chain: consts.PEANUT_WALLET_CHAIN,
                        transport: http(consts.PAYMASTER_URL),
                    })

                    try {
                        return await zerodevPaymaster.sponsorUserOperation({
                            userOperation,
                            shouldOverrideFee: true,
                        })
                    } catch (error) {
                        console.error('Paymaster error:', error)
                        throw error
                    }
                },
            },
        })

        return kernelClient
    }

    // lifecycle hooks
    useEffect(() => {
        const storedWebAuthnKey = getFromLocalStorage(LOCAL_STORAGE_WEB_AUTHN_KEY)
        if (storedWebAuthnKey) {
            setWebAuthnKey(storedWebAuthnKey)
        }
    }, [])

    useEffect(() => {
        let isMounted = true

        if (!webAuthnKey) {
            return () => {
                isMounted = false
            }
        }

        toPasskeyValidator(peanutPublicClient, {
            webAuthnKey,
            entryPoint: consts.USER_OP_ENTRY_POINT,
            kernelVersion: KERNEL_V3_1,
            validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2,
        })
            .then(createKernelClient)
            .then((client) => {
                if (isMounted) {
                    fetchUser()
                    setKernelClient(client)
                    dispatch(zerodevActions.setAddress(client.account!.address))
                    dispatch(zerodevActions.setIsKernelClientReady(true))
                    dispatch(zerodevActions.setIsRegistering(false))
                    dispatch(zerodevActions.setIsLoggingIn(false))
                }
            })

        return () => {
            isMounted = false
        }
    }, [webAuthnKey, dispatch, fetchUser])

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

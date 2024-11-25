// Based on https://github.com/zerodevapp/passkey-tutorial/blob/7e17e287cbaaa1c2f2df53feb016e5fb0a42ac34/app/page.tsx
'use client'

// ZeroDev imports
import {
    createKernelAccount,
    createKernelAccountClient,
    createZeroDevPaymasterClient,
    KernelAccountClient,
} from '@zerodev/sdk'
import {
    toPasskeyValidator,
    toWebAuthnKey,
    WebAuthnMode,
    PasskeyValidatorContractVersion,
} from '@zerodev/passkey-validator'
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants'

// Viem imports
import { arbitrum } from 'viem/chains'
import { createPublicClient, http, parseAbi, encodeFunctionData } from 'viem'

import React, { useEffect, useState } from 'react'

// let kernelAccount: any
let kernelClient: any
let validator: any

// permissionless.js is a TS library built on top of viem to deploy, interact and manage
// ERC-4337 smart accounts, bundlers, paymasters etc.
// import { bundlerActions } from "permissionless"

// This file contains logic for an ZeroDev Account Abstraction (AA) Proof of Concept
// If you don't know what Entry Points, UserOps, ECDSA validators, Kernel clients or
// Passkey validators are, I suggest you read up on:
// - ERC-4337 docs: https://www.erc4337.io/docs
// - ZeroDev docs: https://docs.zerodev.app/

// TODO: break logic in its appropriate files

export const HandleSetupView = ({}) => {
    // data related state
    const [mounted, setMounted] = useState(false)
    const [username, setUsername] = useState('')
    const [accountAddress, setAccountAddress] = useState('')
    const [userOpHash, setUserOpHash] = useState('')
    const [userOpStatus, setUserOpStatus] = useState('')
    const [kernelAccount, setKernelAccount] = useState<any>()
    const [kernelClient, setKernelClient] = useState<any>()

    // let kernelAccount: any
    // let kernelClient: any

    // logic and viz state
    const [isKernelClientReady, setIsKernelClientReady] = useState(false)
    const [isRegistering, setIsRegistering] = useState(false)
    const [isLoggingIn, setIsLoggingIn] = useState(false)
    const [isSendingUserOp, setIsSendingUserOp] = useState(false)

    const BUNDLER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL
    const PAYMASTER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PAYMASTER_URL
    const PASSKEY_SERVER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PASSKEY_SERVER_URL

    const CHAIN = arbitrum
    const entryPoint = getEntryPoint('0.7')

    const contractAddress = '0x34bE7f35132E97915633BC1fc020364EA5134863'
    const contractABI = parseAbi([
        'function mint(address _to) public',
        'function balanceOf(address owner) external view returns (uint256 balance)',
    ])

    const publicClient = createPublicClient({
        chain: CHAIN,
        transport: http(BUNDLER_URL),
    })

    useEffect(() => {
        if (kernelAccount) {
            createZeroDevKernelAccountClient()
        }
    }, [kernelAccount])

    useEffect(() => {
        if (kernelClient) {
            setIsKernelClientReady(true)
            setAccountAddress(kernelAccount.address)
        }
    }, [kernelClient])

    // Function to be called when "Register" is clicked
    const handleRegister = async () => {
        setIsRegistering(true)

        const webAuthnKey = await toWebAuthnKey({
            passkeyName: username,
            passkeyServerUrl: PASSKEY_SERVER_URL as string,
            mode: WebAuthnMode.Register,
            passkeyServerHeaders: {},
        })

        const passkeyValidator = await toPasskeyValidator(publicClient, {
            webAuthnKey,
            entryPoint,
            kernelVersion: KERNEL_V3_1,
            validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2,
        })

        await createAccountAndClient(passkeyValidator)

        setIsRegistering(false)
        window.alert('Register done.  Try sending UserOps.')
    }

    const handleLogin = async () => {
        setIsLoggingIn(true)

        const webAuthnKey = await toWebAuthnKey({
            passkeyName: username,
            passkeyServerUrl: PASSKEY_SERVER_URL as string,
            mode: WebAuthnMode.Login,
            passkeyServerHeaders: {},
        })

        const passkeyValidator = await toPasskeyValidator(publicClient, {
            webAuthnKey,
            entryPoint,
            kernelVersion: KERNEL_V3_1,
            validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2,
        })

        validator = passkeyValidator
        console.log(validator)

        await createAccountAndClient(passkeyValidator)

        setIsLoggingIn(false)
        window.alert('Login done.  Try sending UserOps.')
    }

    const createZeroDevKernelAccount = async (passkeyValidator: any) => {
        const kernelAccountResult = await createKernelAccount(publicClient, {
            plugins: {
                sudo: passkeyValidator,
            },
            entryPoint,
            kernelVersion: KERNEL_V3_1,
        })

        setKernelAccount(kernelAccountResult)
    }

    const createZeroDevKernelAccountClient = () => {
        const kernelClientResult = createKernelAccountClient({
            account: kernelAccount,
            chain: CHAIN,
            bundlerTransport: http(BUNDLER_URL),
            paymaster: {
                getPaymasterData: async (userOperation) => {
                    const zerodevPaymaster = createZeroDevPaymasterClient({
                        chain: CHAIN,
                        transport: http(PAYMASTER_URL),
                    })
                    return zerodevPaymaster.sponsorUserOperation({
                        userOperation,
                    })
                },
            },
        })

        setKernelClient(kernelClientResult)
        // check the useEffect of effects that will happen when kernelClient is set
    }

    const createAccountAndClient = async (passkeyValidator: any) => {
        await createZeroDevKernelAccount(passkeyValidator)
    }

    const handleSendUserOp = async () => {
        setIsSendingUserOp(true)
        setUserOpStatus('Sending UserOp...')
        console.log({ kernelClient })

        const userOperation = await kernelClient.prepareUserOperationRequest({
            userOperation: {
                callData: await kernelAccount.encodeCallData({
                    to: contractAddress,
                    value: BigInt(0),
                    data: encodeFunctionData({
                        abi: contractABI,
                        functionName: 'mint',
                        args: [kernelAccount.address],
                    }),
                }),
            },
        })

        // Sign the user operation
        const signature = await kernelAccount.signUserOperation(userOperation)
        console.log({ signature })

        // Add the signature to the user operation
        const signedUserOperation = {
            ...userOperation,
            signature,
        }

        console.log({ signedUserOperation })

        const kernelAccountResult = await createKernelAccount(publicClient, {
            plugins: {
                sudo: validator,
            },
            entryPoint,
            kernelVersion: KERNEL_V3_1,
        })

        const kernelClientResult = createKernelAccountClient({
            account: kernelAccountResult,
            chain: CHAIN,
            bundlerTransport: http(BUNDLER_URL),
            paymaster: {
                getPaymasterData: async (userOperation) => {
                    const zerodevPaymaster = createZeroDevPaymasterClient({
                        chain: CHAIN,
                        transport: http(PAYMASTER_URL),
                    })
                    return zerodevPaymaster.sponsorUserOperation({
                        userOperation,
                    })
                },
            },
        })

        // Send the user operation
        const userOpHash = await kernelClientResult.sendUserOperation({
            ...signedUserOperation,
        })

        console.log({ userOpHash })

        // const request = await kernelAccount.encodeCallData({
        //     to: contractAddress,
        //     value: BigInt(0),
        //     data: encodeFunctionData({
        //       abi: contractABI,
        //       functionName: "mint",
        //       args: [kernelAccount.address],
        //     }),
        //   }),

        // const signature = await kernelAccount.signUserOperation({
        //     userOperation: {
        //       callData: request
        //     },
        //   })

        // const rpcParameters = formatUserOperationRequest({
        //     ...request,
        //     signature,
        //   } as UserOperation)

        // await publicClient.request(
        //       {
        //         method: 'eth_sendUserOperation',
        //         params: [
        //           rpcParameters,
        //           entryPoint,
        //         ],
        //       },
        //       { retryCount: 0 },
        //     )

        // const userOpHash = await kernelClient.sendUserOperation({
        //   userOperation: {
        //     callData: await kernelAccount.encodeCallData({
        //       to: contractAddress,
        //       value: BigInt(0),
        //       data: encodeFunctionData({
        //         abi: contractABI,
        //         functionName: "mint",
        //         args: [kernelAccount.address],
        //       }),
        //     }),
        //   },
        // })

        // setUserOpHash(userOpHash)

        await kernelClientResult.waitForUserOperationReceipt({
            hash: userOpHash,
        })

        // Update the message based on the count of UserOps
        const userOpMessage = `UserOp completed. <a href="https://jiffyscan.xyz/userOpHash/${userOpHash}?network=sepolia" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700">Click here to view.</a>`
        console.log({ userOpMessage })
        setUserOpStatus(userOpMessage)
        setIsSendingUserOp(false)
    }

    // Spinner component for visual feedback during loading states
    const Spinner = () => (
        <svg
            className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
        </svg>
    )

    return (
        <main className="flex min-h-screen items-center justify-center px-4 py-24">
            <div className="mx-auto w-full max-w-lg">
                <h1 className="mb-12 text-center text-4xl font-semibold">Passkeys</h1>

                <div className="space-y-4">
                    {/* Account Address Label */}
                    {accountAddress && (
                        <div className="mb-4 text-center">
                            Account address:{' '}
                            <a
                                href={`https://jiffyscan.xyz/account/${accountAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700"
                            >
                                {' '}
                                {accountAddress}{' '}
                            </a>
                        </div>
                    )}

                    {/* Input Box */}
                    <input
                        type="text"
                        placeholder="handle"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full border border-gray-300 p-2 text-black"
                    />

                    {/* Register and Login Buttons */}
                    <div className="flex flex-col sm:flex-row sm:space-x-4">
                        {/* Register Button */}
                        <button
                            onClick={handleRegister}
                            disabled={isRegistering || isLoggingIn}
                            className="flex w-full items-center justify-center bg-blue-500 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                        >
                            {isRegistering ? <Spinner /> : 'Register'}
                        </button>

                        {/* Login Button */}
                        <button
                            onClick={handleLogin}
                            disabled={isLoggingIn || isRegistering}
                            className="mt-2 flex w-full items-center justify-center bg-purple-500 px-4 py-2 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 sm:mt-0"
                        >
                            {isLoggingIn ? <Spinner /> : 'Login'}
                        </button>
                    </div>

                    {/* Send UserOp Button */}
                    <div className="flex w-full flex-col items-center">
                        <button
                            onClick={handleSendUserOp}
                            disabled={!isKernelClientReady || isSendingUserOp}
                            className={`flex w-full items-center justify-center px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-opacity-50 ${
                                isKernelClientReady && !isSendingUserOp
                                    ? 'bg-green-500 hover:bg-green-700 focus:ring-green-500'
                                    : 'bg-gray-500'
                            }`}
                        >
                            {isSendingUserOp ? <Spinner /> : 'Send UserOp'}
                        </button>
                        {/* UserOp Status Label */}
                        {userOpHash && (
                            <div
                                className="mt-4"
                                dangerouslySetInnerHTML={{
                                    __html: userOpStatus,
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </main>
    )
}

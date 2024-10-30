// Note: Adding not check because @zeodev/waas in not installed anymore but keeping code for reference
// @ts-nocheck
// Based on https://docs.zerodev.app/smart-wallet/quickstart-react
// Converts the Handle.view.tsx via the waas provider

// Note: Handle.view.tsx remains an excellent example to simply understand
// what goes on under the hood and how you can sign and THEN send a tx
'use client'
// viem imports
import { parseAbi } from "viem"

// ZeroDev imports
import { useCreateKernelClientPasskey, useSendUserOperation, useKernelClient } from "@zerodev/waas"

import React, { useState } from "react"

// This file contains logic for an ZeroDev Account Abstraction (AA) Proof of Concept
// If you don't know what Entry Points, UserOps, ECDSA validators, Kernel clients or 
// Passkey validators are, I suggest you read up on:
// - ERC-4337 docs: https://www.erc4337.io/docs
// - ZeroDev docs: https://docs.zerodev.app/

export const HandleSetupView = ({ }) => {
    const [username, setUsername] = useState("")
    const [userOpStatus, setUserOpStatus] = useState("")

    const { address } = useKernelClient()
    const {
        connectRegister,        // TODO: check async version
        connectLogin,           // TODO: check async version
        isPending: isCreateKernelPending,              // used as isRegistering
    } = useCreateKernelClientPasskey({ version: "v3" });

    const { data: userOpHash, write, isPending: isUserOpPending, } = useSendUserOperation({
        paymaster: {
            type: "SPONSOR"
        }
    })

    const contractAddress = "0x34bE7f35132E97915633BC1fc020364EA5134863"
    const contractABI = parseAbi([
        "function mint(address _to) public",
        "function balanceOf(address owner) external view returns (uint256 balance)"
    ])


    // const userOperation = await kernelClient.prepareUserOperationRequest({
    //     userOperation: {
    //       callData: await kernelAccount.encodeCallData({
    //         to: contractAddress,
    //         value: BigInt(0),
    //         data: encodeFunctionData({
    //           abi: contractABI,
    //           functionName: "mint",
    //           args: [kernelAccount.address],
    //         }),
    //       }),
    //     },
    //   });

    const handleSendUserOp = async () => {
        setUserOpStatus('Sending UserOp...')
        write([
            {
                address: contractAddress,
                abi: contractABI,
                functionName: "mint",
                args: [address],
                value: BigInt(0),
            }
        ])


        setUserOpStatus(
            `Success! </br> \\
            UserOp completed. \\
                <a href="https://jiffyscan.xyz/userOpHash/${userOpHash}?network=sepolia" \\
                target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700"> \\
                    Click here to view. \\
                </a>
            `)
    }

    // Spinner component for visual feedback during loading states
    const Spinner = () => (
        <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            ></circle>
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
        </svg>
    )

    return (
        <main className="flex items-center justify-center min-h-screen px-4 py-24">
            <div className="w-full max-w-lg mx-auto">
                <h1 className="text-4xl font-semibold text-center mb-12">
                    Passkeys
                </h1>

                <div className="space-y-4">
                    {/* Account Address Label */}
                    {address && (
                        <div className="text-center mb-4">
                            Account address:{" "}
                            <a
                                href={`https://jiffyscan.xyz/account/${address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700"
                            >
                                {" "}
                                {address}{" "}
                            </a>
                        </div>
                    )}

                    {/* Input Box */}
                    <input
                        type="text"
                        placeholder="handle"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="p-2 text-black border border-gray-300 w-full"
                    />

                    {/* Register and Login Buttons */}
                    <div className="flex flex-col sm:flex-row sm:space-x-4">
                        {/* Register Button */}
                        <button
                            onClick={() => {
                                connectRegister({ username: username })
                            }}
                            disabled={isCreateKernelPending}
                            className="flex justify-center items-center px-4 py-2 bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 w-full"
                        >
                            {isCreateKernelPending ? <Spinner /> : "Register"}
                        </button>

                        {/* Login Button */}
                        <button
                            onClick={connectLogin}
                            disabled={isCreateKernelPending}
                            className="mt-2 sm:mt-0 flex justify-center items-center px-4 py-2 bg-purple-500 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 w-full"
                        >
                            {isCreateKernelPending ? <Spinner /> : "Login"}
                        </button>
                    </div>

                    {/* Send UserOp Button */}
                    <div className="flex flex-col items-center w-full">
                        <button
                            onClick={handleSendUserOp}
                            disabled={isCreateKernelPending || isUserOpPending}
                            className={`px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-opacity-50 flex justify-center items-center w-full ${!isCreateKernelPending && !isUserOpPending
                                ? "bg-green-500 hover:bg-green-700 focus:ring-green-500"
                                : "bg-gray-500"
                                }`}
                        >
                            {isUserOpPending ? <Spinner /> : "Send UserOp"}
                        </button>
                        {userOpHash && <p>{`UserOp Hash: ${userOpHash}`}</p>}
                        {/* UserOp Status Label */}
                        {userOpHash && (
                            <div
                                className="mt-4"
                                dangerouslySetInnerHTML={{
                                    __html: userOpStatus
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </main>
    )
}
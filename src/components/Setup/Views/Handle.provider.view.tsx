// Based on https://github.com/zerodevapp/passkey-tutorial/blob/7e17e287cbaaa1c2f2df53feb016e5fb0a42ac34/app/page.tsx
'use client'

// ZeroDev imports
import {
    createKernelAccount,
    createKernelAccountClient,
    createZeroDevPaymasterClient,
    KernelAccountClient
} from "@zerodev/sdk"
import {
    toPasskeyValidator,
    toWebAuthnKey,
    WebAuthnMode,
    PasskeyValidatorContractVersion
} from "@zerodev/passkey-validator"
import { KERNEL_V3_1 } from "@zerodev/sdk/constants"

// Viem imports
import { arbitrum } from 'viem/chains'
import { createPublicClient, http, parseAbi, encodeFunctionData, } from "viem"

// Permissionless imports

import React, { useEffect, useState } from "react"
import { useZeroDev } from "@/context/walletContext/zeroDevContext.context"
import { useWallet } from "@/context/walletContext"
import { WalletProviderType } from "@/interfaces"
import { useAccount } from "wagmi"



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

export const HandleSetupView = ({ }) => {
    // data related state
    const [mounted, setMounted] = useState(false)
    const [username, setUsername] = useState("")
    const [accountAddress, setAccountAddress] = useState("")
    const [userOpHash, setUserOpHash] = useState("")
    const [userOpStatus, setUserOpStatus] = useState("")

    const { address: wagmiAddress } = useAccount()

    const {
        address: kernelClientAddress,
        isRegistering,
        isLoggingIn,
        isKernelClientReady,
        isSendingUserOp,
        handleLogin,
        handleRegister,
        handleSendUserOpNotEncoded,
    } = useZeroDev()


    useEffect(() => {
        console.log({ isKernelClientReady })
    }, [isKernelClientReady]);

    const { wallets, checkActivateWallet, activeWallet } = useWallet()


    const contractAddress = "0x34bE7f35132E97915633BC1fc020364EA5134863"
    const contractABI = parseAbi([
        "function mint(address _to) public",
        "function balanceOf(address owner) external view returns (uint256 balance)"
    ])

    const handleSendUserOp = async () => {
        const userOpHash = await handleSendUserOpNotEncoded({
            to: contractAddress,
            value: 0,
            abi: contractABI,
            functionName: 'mint',
            args: [kernelClientAddress],
        })

        console.log(userOpHash)
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
                    {kernelClientAddress && (
                        <div className="text-center mb-4">
                            Account address:{" "}
                            <a
                                href={`https://jiffyscan.xyz/account/${kernelClientAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700"
                            >
                                {" "}
                                {kernelClientAddress}{" "}
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
                    {/* Test buttons to switch between PW and BYOW */}
                    <div className="flex flex-col sm:flex-row sm:space-x-4">
                        {/* PW Button */}
                        {/* Note: These buttons don't have CSS when disabled, they are just not clicked */}
                        <button
                            onClick={() => {
                                const pWallet = wallets.find((wallet) => wallet.address == kernelClientAddress)
                                checkActivateWallet(pWallet!)
                            }}
                            disabled={!isKernelClientReady}
                            className="flex justify-center items-center px-4 py-2 bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 w-full"
                        >
                            {isRegistering ? <Spinner /> : "Select PW"}
                        </button>

                        {/* BYOW Button */}
                        {/* Note: These buttons don't have CSS when disabled, they are just not clicked */}
                        <button
                            onClick={() => {
                                const wallet = wallets.find((wallet) => wallet.address == wagmiAddress)
                                checkActivateWallet(wallet!)
                            }}
                            disabled={!wagmiAddress}
                            className="mt-2 sm:mt-0 flex justify-center items-center px-4 py-2 bg-purple-500 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 w-full"
                        >
                            {"Select BYOW"}
                        </button>
                    </div>
                    {activeWallet && (
                        <>
                            {activeWallet.walletProviderType}
                            {activeWallet.address}
                            {activeWallet.connected}
                        </>
                    )}


                    {/* Register and Login Buttons */}
                    <div className="flex flex-col sm:flex-row sm:space-x-4">
                        {/* Register Button */}
                        <button
                            onClick={() => {
                                handleRegister(username)
                            }}
                            disabled={isRegistering || isLoggingIn}
                            className="flex justify-center items-center px-4 py-2 bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 w-full"
                        >
                            {isRegistering ? <Spinner /> : "Register"}
                        </button>

                        {/* Login Button */}
                        <button
                            onClick={() => {
                                handleLogin(username)
                            }}
                            disabled={isLoggingIn || isRegistering}
                            className="mt-2 sm:mt-0 flex justify-center items-center px-4 py-2 bg-purple-500 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 w-full"
                        >
                            {isLoggingIn ? <Spinner /> : "Login"}
                        </button>
                    </div>

                    {/* Send UserOp Button */}
                    <div className="flex flex-col items-center w-full">
                        <button
                            onClick={handleSendUserOp}
                            disabled={!isKernelClientReady || isSendingUserOp}
                            className={`px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-opacity-50 flex justify-center items-center w-full ${isKernelClientReady && !isSendingUserOp
                                ? "bg-green-500 hover:bg-green-700 focus:ring-green-500"
                                : "bg-gray-500"
                                }`}
                        >
                            {isSendingUserOp ? <Spinner /> : "Send UserOp"}
                        </button>
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

'use client'
import { ReactNode, createContext, useContext, useState } from 'react'

// ZeroDev imports
import * as consts from '@/constants/zerodev.consts'
import { http, encodeFunctionData, Abi, Transport, Hex, Address } from 'viem'
import {
    createKernelAccount,
    createKernelAccountClient,
    createZeroDevPaymasterClient,
    KernelAccountClient,
    KernelSmartAccount,
} from '@zerodev/sdk'
import {
    toPasskeyValidator,
    toWebAuthnKey,
    WebAuthnMode,
    PasskeyValidatorContractVersion,
} from '@zerodev/passkey-validator'
import { KERNEL_V3_1 } from '@zerodev/sdk/constants'

// Permissionless imports
import { bundlerActions, type BundlerClient } from 'permissionless'
import { useToast } from '@/components/0_Bruddle/Toast'
import { peanutPublicClient } from '@/constants/viem.consts'
import { infuraRpcUrls } from '@/constants'
import { useAuth } from '../authContext'

// Note: Use this type as SmartAccountClient if needed. Typescript will be angry if Client isn't typed very specifically
type AppSmartAccountClient = KernelAccountClient<
    typeof consts.USER_OP_ENTRY_POINT,
    Transport,
    typeof consts.PEANUT_WALLET_CHAIN,
    KernelSmartAccount<typeof consts.USER_OP_ENTRY_POINT, Transport, typeof consts.PEANUT_WALLET_CHAIN>
>
type UserOpNotEncodedParams = {
    to: Address // contractAddress to send userop to
    value: number
    abi: Abi // abi already parsed via the parseAbi() viem func
    functionName: string
    args: any[]
}
type UserOpEncodedParams = {
    to: Address
    value: BigInt | null
    data: Hex
}
interface ZeroDevContextType {
    isKernelClientReady: boolean
    setIsKernelClientReady: (clientReady: boolean) => void
    isRegistering: boolean
    setIsRegistering: (registering: boolean) => void
    isLoggingIn: boolean
    setIsLoggingIn: (loggingIn: boolean) => void
    isSendingUserOp: boolean
    setIsSendingUserOp: (sendingUserOp: boolean) => void
    handleRegister: (handle: string) => Promise<AppSmartAccountClient>
    handleLogin: () => Promise<void>
    handleSendUserOpEncoded: (args: UserOpEncodedParams) => Promise<string> // TODO: return type may be undefined here (if userop fails for whatever reason)
    handleSendUserOpNotEncoded: (args: UserOpNotEncodedParams) => Promise<string> // TODO: return type may be undefined here (if userop fails for whatever reason)
    address: string | undefined
}

// TODO: remove any unused imports
// TODO: order imports

const ZeroDevContext = createContext<ZeroDevContextType | undefined>(undefined)

// TODO: change description
/**
 * Context provider to manage user authentication and profile interactions.
 * It handles fetching the user profile, updating user details (e.g., username, profile photo),
 * adding accounts and logging out. It also provides hooks for child components to access user data and auth-related functions.
 */
export const ZeroDevProvider = ({ children }: { children: ReactNode }) => {
    const toast = useToast()
    const { fetchUser } = useAuth()
    const _getPasskeyName = (handle: string) => `${handle}.peanut.wallet`
    ////// context props
    //

    ////// ZeroDev props
    //

    const [isRegistering, setIsRegistering] = useState<boolean>(false)
    const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false)
    const [isSendingUserOp, setIsSendingUserOp] = useState<boolean>(false)

    const [kernelClient, setKernelClient] = useState<AppSmartAccountClient | undefined>(undefined)
    const [isKernelClientReady, setIsKernelClientReady] = useState<boolean>(false)
    const [address, setAddress] = useState<string | undefined>(undefined)

    ////// Lifecycle hooks
    //

    ////// Setup functions
    //
    const createKernelClient = async (passkeyValidator: any) => {
        console.log({ passkeyValidator })
        const kernelAccount = await createKernelAccount(peanutPublicClient, {
            plugins: {
                sudo: passkeyValidator,
            },
            entryPoint: consts.USER_OP_ENTRY_POINT,
            kernelVersion: KERNEL_V3_1,
        })

        console.log({ kernelAccount })

        console.log('Creating kernel account client with consts')
        console.dir(consts)
        const kernelClient = createKernelAccountClient({
            account: kernelAccount,
            chain: consts.PEANUT_WALLET_CHAIN,
            bundlerTransport: http(consts.BUNDLER_URL),
            entryPoint: consts.USER_OP_ENTRY_POINT,
            middleware: {
                sponsorUserOperation: async ({ userOperation }) => {
                    const zerodevPaymaster = createZeroDevPaymasterClient({
                        chain: consts.PEANUT_WALLET_CHAIN,
                        transport: http(consts.PAYMASTER_URL),
                        entryPoint: consts.USER_OP_ENTRY_POINT,
                    })
                    return zerodevPaymaster.sponsorUserOperation({
                        userOperation,
                        entryPoint: consts.USER_OP_ENTRY_POINT,
                    })
                },
            },
        })

        console.log({ kernelClient })

        setKernelClient(kernelClient)
        setAddress(kernelClient.account!.address)
        setIsKernelClientReady(true)

        return kernelClient
    }

    // TODO: handle logout
    // setKernelClient(undefined)
    // setIsKernelClientReady(false)

    ////// Register functions
    //
    const handleRegister = async (handle: string): Promise<AppSmartAccountClient> => {
        setIsRegistering(true)

        console.log({
            bundlerURL: consts.BUNDLER_URL,
            paymasterURL: consts.PAYMASTER_URL,
            passkeyServerURL: consts.PASSKEY_SERVER_URL,
            infuraRpcUrl: infuraRpcUrls[consts.PEANUT_WALLET_CHAIN.id],
        })

        const webAuthnKey = await toWebAuthnKey({
            passkeyName: _getPasskeyName(handle),
            passkeyServerUrl: consts.PASSKEY_SERVER_URL as string,
            mode: WebAuthnMode.Register,
            passkeyServerHeaders: {},
            rpID: window.location.hostname,
        })

        console.log({ peanutPublicClient })

        const passkeyValidator = await toPasskeyValidator(peanutPublicClient, {
            webAuthnKey,
            entryPoint: consts.USER_OP_ENTRY_POINT,
            kernelVersion: KERNEL_V3_1,
            validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2,
        })

        const client = await createKernelClient(passkeyValidator)

        setIsRegistering(false)

        return client
    }

    ////// Login functions
    //
    const handleLogin = async () => {
        setIsLoggingIn(true)
        try {
            const webAuthnKey = await toWebAuthnKey({
                passkeyName: '[]',
                passkeyServerUrl: consts.PASSKEY_SERVER_URL as string,
                mode: WebAuthnMode.Login,
                passkeyServerHeaders: {},
                rpID: window.location.hostname,
            })

            const passkeyValidator = await toPasskeyValidator(peanutPublicClient, {
                webAuthnKey,
                entryPoint: consts.USER_OP_ENTRY_POINT,
                kernelVersion: KERNEL_V3_1,
                validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2,
            })

            await createKernelClient(passkeyValidator)
        } catch (e) {
            console.error('Error logging in', e)
        } finally {
            await fetchUser()
            setIsLoggingIn(false)
        }
    }

    ////// UserOp functions
    //

    // TODO: better docstrings
    // used when data is already encoded from Peanut
    // but remains unsigned
    const handleSendUserOpEncoded = async ({ to, value, data }: UserOpEncodedParams) => {
        setIsSendingUserOp(true)
        const userOpHash = await kernelClient!.sendUserOperation({
            account: kernelClient!.account,
            userOperation: {
                callData: await kernelClient!.account!.encodeCallData({
                    to: (to ? to : '') as `0x${string}`,
                    value: value ? BigInt(value.toString()) : BigInt(0),
                    data,
                }),
            },
        })

        // type: Permisionless.js BundlerClient
        const bundlerClient = kernelClient!.extend(
            bundlerActions(consts.USER_OP_ENTRY_POINT)
        ) as AppSmartAccountClient & BundlerClient<typeof consts.USER_OP_ENTRY_POINT, typeof consts.PEANUT_WALLET_CHAIN>

        const receipt = await bundlerClient.waitForUserOperationReceipt({
            hash: userOpHash,
        })

        console.log({ receipt })

        // Update the message based on the count of UserOps
        const userOpMessage = `UserOp completed. <a href="https://jiffyscan.xyz/userOpHash/${userOpHash}?network=sepolia" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700">Click here to view.</a>`
        console.log({ userOpMessage })
        setIsSendingUserOp(false)

        return receipt.receipt.transactionHash
    }

    // used when data is NOT already encoded from Peanut
    // but remains unsigned
    const handleSendUserOpNotEncoded = async ({ to, value, abi, functionName, args }: UserOpNotEncodedParams) => {
        setIsSendingUserOp(true)

        console.log('userop')
        console.log({ kernelClient })
        console.log({ account: kernelClient!.account })
        console.log({
            to,
            value,
            abi,
            functionName,
            args,
        })

        const userOpHash = await kernelClient!.sendUserOperation({
            account: kernelClient!.account,
            userOperation: {
                callData: await kernelClient!.account.encodeCallData({
                    to,
                    value: BigInt(value),
                    data: encodeFunctionData({
                        abi,
                        functionName,
                        args,
                    }),
                }),
            },
        })

        const bundlerClient = kernelClient!.extend(
            bundlerActions(consts.USER_OP_ENTRY_POINT)
        ) as AppSmartAccountClient & BundlerClient<typeof consts.USER_OP_ENTRY_POINT, typeof consts.PEANUT_WALLET_CHAIN>

        await bundlerClient!.waitForUserOperationReceipt({
            hash: userOpHash,
        })

        // Update the message based on the count of UserOps
        const userOpMessage = `UserOp completed. <a href="https://jiffyscan.xyz/userOpHash/${userOpHash}?network=sepolia" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700">Click here to view.</a>`
        console.log({ userOpMessage })
        setIsSendingUserOp(false)

        return userOpHash
    }

    return (
        <ZeroDevContext.Provider
            value={{
                isKernelClientReady,
                setIsKernelClientReady,
                isRegistering,
                setIsRegistering,
                isLoggingIn,
                setIsLoggingIn,
                isSendingUserOp,
                setIsSendingUserOp,
                handleRegister,
                handleLogin,
                handleSendUserOpEncoded,
                handleSendUserOpNotEncoded,
                address,
            }}
        >
            {children}
        </ZeroDevContext.Provider>
    )
}

export const useZeroDev = (): ZeroDevContextType => {
    const context = useContext(ZeroDevContext)
    if (context === undefined) {
        throw new Error('useWallet must be used within an AuthProvider')
    }
    return context
}

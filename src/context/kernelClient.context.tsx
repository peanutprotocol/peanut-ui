'use client'

import { peanutPublicClient } from '@/constants/viem.consts'
import * as consts from '@/constants/zerodev.consts'
import { useAuth } from '@/context/authContext'
import { useAppDispatch } from '@/redux/hooks'
import { zerodevActions } from '@/redux/slices/zerodev-slice'
import { getFromLocalStorage } from '@/utils'
import { PasskeyValidatorContractVersion, toPasskeyValidator, toWebAuthnKey } from '@zerodev/passkey-validator'
import {
    createKernelAccount,
    createKernelAccountClient,
    createZeroDevPaymasterClient,
    KernelAccountClient,
} from '@zerodev/sdk'
import { KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { createContext, useEffect, useState, useContext, ReactNode } from 'react'
import { http, Transport } from 'viem'

interface KernelClientContextType {
    kernelClient: AppSmartAccountClient | undefined
    setWebAuthnKey: (webAuthnKey: WebAuthnKey) => void
}

// types
type AppSmartAccountClient = KernelAccountClient<Transport, typeof consts.PEANUT_WALLET_CHAIN>

type WebAuthnKey = Awaited<ReturnType<typeof toWebAuthnKey>>

const LOCAL_STORAGE_WEB_AUTHN_KEY = 'web-authn-key'

const KernelClientContext = createContext<KernelClientContextType | undefined>(undefined)

const createKernelClient = async (passkeyValidator: any) => {
    console.log('Creating new kernel client...')
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

export const KernelClientProvider = ({ children }: { children: ReactNode }) => {
    const [kernelClient, setKernelClient] = useState<AppSmartAccountClient>()
    const [webAuthnKey, setWebAuthnKey] = useState<WebAuthnKey | undefined>(undefined)
    const dispatch = useAppDispatch()
    const { fetchUser } = useAuth()

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

        const initializeClient = async () => {
            try {
                const validator = await toPasskeyValidator(peanutPublicClient, {
                    webAuthnKey,
                    entryPoint: consts.USER_OP_ENTRY_POINT,
                    kernelVersion: KERNEL_V3_1,
                    validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2,
                })

                const client = await createKernelClient(validator)

                if (isMounted) {
                    fetchUser()
                    setKernelClient(client)
                    dispatch(zerodevActions.setAddress(client.account!.address))
                    dispatch(zerodevActions.setIsKernelClientReady(true))
                    dispatch(zerodevActions.setIsRegistering(false))
                    dispatch(zerodevActions.setIsLoggingIn(false))
                }
            } catch (error) {
                console.error('Error initializing kernel client:', error)
                dispatch(zerodevActions.setIsKernelClientReady(false))
            }
        }

        initializeClient()

        return () => {
            isMounted = false
        }
    }, [webAuthnKey])

    return (
        <KernelClientContext.Provider
            value={{
                kernelClient,
                setWebAuthnKey,
            }}
        >
            {children}
        </KernelClientContext.Provider>
    )
}

export const useKernelClient = (): KernelClientContextType => {
    const context = useContext(KernelClientContext)
    if (context === undefined) {
        throw new Error('useKernelClient must be used within a KernelClientProvider')
    }
    return context
}

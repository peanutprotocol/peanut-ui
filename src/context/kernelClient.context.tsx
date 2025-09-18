'use client'
import {
    PEANUT_WALLET_CHAIN,
    PUBLIC_CLIENTS_BY_CHAIN,
    USER_OP_ENTRY_POINT,
    ZERODEV_KERNEL_VERSION,
} from '@/constants/zerodev.consts'
import { useAuth } from '@/context/authContext'
import { createKernelMigrationAccount } from '@zerodev/sdk/accounts'
import { useAppDispatch } from '@/redux/hooks'
import { zerodevActions } from '@/redux/slices/zerodev-slice'
import { getFromCookie, getFromLocalStorage } from '@/utils'
import { PasskeyValidatorContractVersion, toPasskeyValidator, toWebAuthnKey } from '@zerodev/passkey-validator'
import {
    createKernelAccount,
    createKernelAccountClient,
    createZeroDevPaymasterClient,
    KernelAccountClient,
} from '@zerodev/sdk'
import { createContext, ReactNode, useCallback, useContext, useEffect, useState, useMemo } from 'react'
import { Chain, http, PublicClient, Transport } from 'viem'
import type { Address } from 'viem'
import { captureException } from '@sentry/nextjs'

interface KernelClientContextType {
    setWebAuthnKey: (webAuthnKey: WebAuthnKey) => void
    getClientForChain: (chainId: string) => GenericSmartAccountClient
}

type GenericSmartAccountClient<C extends Chain = Chain> = KernelAccountClient<Transport, C>

type WebAuthnKey = Awaited<ReturnType<typeof toWebAuthnKey>>

const LOCAL_STORAGE_WEB_AUTHN_KEY = 'web-authn-key'

const KernelClientContext = createContext<KernelClientContextType | undefined>(undefined)

export const createPasskeyValidator = async (
    publicClient: PublicClient,
    webAuthnKey: WebAuthnKey,
    validatorContractVersion: PasskeyValidatorContractVersion = PasskeyValidatorContractVersion.V0_0_3_PATCHED
) => {
    return await toPasskeyValidator(publicClient, {
        webAuthnKey,
        entryPoint: USER_OP_ENTRY_POINT,
        kernelVersion: ZERODEV_KERNEL_VERSION,
        validatorContractVersion,
    })
}

export interface KernelClientOptions {
    bundlerUrl: string
    paymasterUrl: string
}

export const createKernelClientForChain = async <C extends Chain>(
    publicClient: PublicClient,
    chain: C,
    shouldUseNewKernel: boolean = false,
    webAuthnKey: WebAuthnKey,
    address: Address | undefined,
    options: KernelClientOptions
): Promise<GenericSmartAccountClient<C>> => {
    console.log(`Creating new kernel client for chain ${chain.name}...`)

    const { bundlerUrl, paymasterUrl } = options

    let kernelAccount: Awaited<ReturnType<typeof createKernelAccount>>
    const newValidator = await createPasskeyValidator(publicClient, webAuthnKey)
    if (!shouldUseNewKernel) {
        if (!address) {
            throw new Error('Address is required for migration kernel')
        }
        const oldValidator = await createPasskeyValidator(
            publicClient,
            webAuthnKey,
            PasskeyValidatorContractVersion.V0_0_2_UNPATCHED
        )
        kernelAccount = await createKernelMigrationAccount(publicClient, {
            address,
            plugins: {
                sudo: {
                    migrate: {
                        from: oldValidator,
                        to: newValidator,
                    },
                },
            },
            entryPoint: USER_OP_ENTRY_POINT,
            kernelVersion: ZERODEV_KERNEL_VERSION,
        })
    } else {
        kernelAccount = await createKernelAccount(publicClient, {
            plugins: {
                sudo: newValidator,
            },
            entryPoint: USER_OP_ENTRY_POINT,
            kernelVersion: ZERODEV_KERNEL_VERSION,
        })
    }

    const kernelClient = createKernelAccountClient({
        account: kernelAccount,
        chain: chain,
        bundlerTransport: http(bundlerUrl),
        pollingInterval: 500,
        userOperation:
            // for arbitrum (peanut_wallet_chain):
            // use zerodev's ultra relay (docs.zerodev.app/sdk/core-api/sponsor-gas#ultrarelay).
            // this requires gas fees set to 0 for optimal performance/sponsorship.
            //
            // for polygon (pimlico provider) & other chains:
            // do not hardcode gas. allows standard gas estimation, preventing underpriced tx failures.
            // note using pimlico provider, for polygon, cuz it doesnt support ultra relay yet and alchemy (default provider) fails to estimate gas.
            chain.id.toString() === PEANUT_WALLET_CHAIN.id.toString()
                ? {
                      // better performance: https://docs.zerodev.app/sdk/core-api/sponsor-gas#ultrarelay
                      estimateFeesPerGas: async ({ bundlerClient: _ }) => {
                          return {
                              maxFeePerGas: BigInt(0),
                              maxPriorityFeePerGas: BigInt(0),
                          }
                      },
                  }
                : undefined,
        paymaster: {
            getPaymasterData: async (userOperation) => {
                const zerodevPaymaster = createZeroDevPaymasterClient({
                    chain: chain,
                    transport: http(paymasterUrl),
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

const ZERODEV_MIGRATION_DATE = new Date('2025-09-18T12:00:00.000Z')

export const KernelClientProvider = ({ children }: { children: ReactNode }) => {
    const [clientsByChain, setClientsByChain] = useState<Record<string, GenericSmartAccountClient>>({})
    const [webAuthnKey, setWebAuthnKey] = useState<WebAuthnKey | undefined>(undefined)
    const dispatch = useAppDispatch()
    const { fetchUser, logoutUser, user } = useAuth()

    const isAfterZeroDevMigration = useMemo<boolean>(() => {
        if (!user?.user?.createdAt) {
            return true
        }
        return new Date(user.user.createdAt) > ZERODEV_MIGRATION_DATE
    }, [user?.user?.createdAt])

    // lifecycle hooks
    useEffect(() => {
        const storedWebAuthnKey =
            getFromLocalStorage(LOCAL_STORAGE_WEB_AUTHN_KEY) || getFromCookie(LOCAL_STORAGE_WEB_AUTHN_KEY)
        if (storedWebAuthnKey) {
            setWebAuthnKey(storedWebAuthnKey)
        } else {
            // avoid mixed state
            logoutUser()
        }
    }, [])

    useEffect(() => {
        let isMounted = true

        if (!webAuthnKey) {
            return () => {
                isMounted = false
            }
        }

        const initializeClients = async () => {
            const newClientsByChain: Record<string, GenericSmartAccountClient> = {}
            for (const chainId in PUBLIC_CLIENTS_BY_CHAIN) {
                const { client, chain, bundlerUrl, paymasterUrl } = PUBLIC_CLIENTS_BY_CHAIN[chainId]
                try {
                    const kernelClient = await createKernelClientForChain(
                        client,
                        chain,
                        isAfterZeroDevMigration,
                        webAuthnKey,
                        isAfterZeroDevMigration
                            ? undefined
                            : (user?.accounts.find((a) => a.type === 'peanut-wallet')!.identifier as Address),
                        {
                            bundlerUrl,
                            paymasterUrl,
                        }
                    )
                    newClientsByChain[chainId] = kernelClient
                } catch (error) {
                    console.error(`Error creating kernel client for chain ${chainId}:`, error)
                    captureException(error)
                    continue
                }
            }
            if (isMounted) {
                fetchUser()
                setClientsByChain(newClientsByChain)
                dispatch(zerodevActions.setIsKernelClientReady(true))
                dispatch(zerodevActions.setIsRegistering(false))
                dispatch(zerodevActions.setIsLoggingIn(false))
            }
        }

        initializeClients()

        return () => {
            isMounted = false
        }
    }, [webAuthnKey, isAfterZeroDevMigration])

    useEffect(() => {
        const peanutClient = clientsByChain[PEANUT_WALLET_CHAIN.id]
        if (peanutClient) {
            dispatch(zerodevActions.setAddress(peanutClient.account!.address))
        }
    }, [clientsByChain])

    const getClientForChain = useCallback(
        (chainId: string) => {
            const client = clientsByChain[chainId]
            if (!client) {
                throw new Error(`No client found for chain ${chainId}`)
            }
            return client
        },
        [clientsByChain]
    )

    return (
        <KernelClientContext.Provider
            value={{
                setWebAuthnKey,
                getClientForChain,
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

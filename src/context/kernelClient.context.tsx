'use client'
import { HARNESS_ENABLED } from '@/constants/harness.consts'
import {
    PEANUT_WALLET_CHAIN,
    USER_OP_ENTRY_POINT,
    ZERODEV_KERNEL_VERSION,
    ZERODEV_RPC_TIMEOUT_MS,
} from '@/constants/zerodev.consts'
import { useAuth } from '@/context/authContext'
import { createKernelMigrationAccount } from '@zerodev/sdk/accounts'
import { useAppDispatch } from '@/redux/hooks'
import { zerodevActions } from '@/redux/slices/zerodev-slice'
import { getFromCookie, updateUserPreferences, getUserPreferences } from '@/utils/general.utils'
import { PasskeyValidatorContractVersion, toPasskeyValidator, toWebAuthnKey } from '@zerodev/passkey-validator'
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
import {
    createKernelAccount,
    createKernelAccountClient,
    createZeroDevPaymasterClient,
    type KernelAccountClient,
} from '@zerodev/sdk'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react'
import { type Chain, http, type PublicClient, type Transport } from 'viem'
import { AccountType } from '@/interfaces/interfaces'
import type { Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { captureException } from '@sentry/nextjs'
import { retryAsync } from '@/utils/retry.utils'
import { isStaleClientForUser, isStaleKeyError, createStaleSessionError } from '@/utils/walletCredential.utils'
import { isAndroidNative, getNativeRpId } from '@/utils/capacitor'
import { createNativeSignMessageCallback } from '@/utils/native-webauthn'
import { PUBLIC_CLIENTS_BY_CHAIN } from '@/app/actions/clients'

interface KernelClientContextType {
    setWebAuthnKey: (webAuthnKey: WebAuthnKey) => void
    getClientForChain: (chainId: string) => GenericSmartAccountClient
    // Lazy-builds (and caches) a kernel client for `chainId` if it isn't already
    // ready. Awaiting this before `getClientForChain` is what lets us skip
    // eager-init for non-Arb chains (mainnet/base/linea — recovery-only).
    // Cached chains resolve immediately; concurrent calls dedupe via inFlightRef.
    ensureClientForChain: (chainId: string) => Promise<GenericSmartAccountClient>
}

type GenericSmartAccountClient<C extends Chain = Chain> = KernelAccountClient<Transport, C>

type WebAuthnKey = Awaited<ReturnType<typeof toWebAuthnKey>>

const WEB_AUTHN_COOKIE_KEY = 'web-authn-key'

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

// Harness-only: when the playwright session sets window.__harness_ecdsa_pk,
// build the kernel client with an ECDSA validator over that private key
// instead of the passkey validator. This lets Playwright drive real userops
// end-to-end (no way to sign WebAuthn passkeys headlessly). The rest of the
// kernel client code path — bundler, kernel factory — is unchanged.
// Gated on __harness_skip_passkey = 'true' so the code is unreachable in prod.
//
// Sponsorship: if window.__harness_ecdsa_sponsored === 'true' (default), use
// the ZeroDev paymaster. If set to 'false', smart account pays its own gas
// (requires ETH on the SA). Use unsponsored when the sandbox ZeroDev project
// has no sponsor policy configured — which is the case for Arb Sepolia today.
export const createHarnessEcdsaKernelClient = async <C extends Chain>(
    publicClient: PublicClient,
    chain: C,
    privateKey: `0x${string}`,
    { bundlerUrl, paymasterUrl }: { bundlerUrl: string; paymasterUrl: string }
): Promise<GenericSmartAccountClient<C>> => {
    const signer = privateKeyToAccount(privateKey)
    const validator = await signerToEcdsaValidator(publicClient, {
        signer,
        entryPoint: USER_OP_ENTRY_POINT,
        kernelVersion: ZERODEV_KERNEL_VERSION,
    })
    const kernelAccount = await createKernelAccount(publicClient, {
        plugins: { sudo: validator },
        entryPoint: USER_OP_ENTRY_POINT,
        kernelVersion: ZERODEV_KERNEL_VERSION,
    })

    const sponsored =
        typeof window !== 'undefined' && window.localStorage?.getItem('__harness_ecdsa_sponsored') !== 'false'

    const clientConfig: Parameters<typeof createKernelAccountClient>[0] = {
        account: kernelAccount,
        chain,
        bundlerTransport: http(bundlerUrl),
        pollingInterval: 500,
    }

    if (sponsored) {
        clientConfig.paymaster = {
            getPaymasterData: async (userOperation) => {
                const zerodevPaymaster = createZeroDevPaymasterClient({
                    chain,
                    transport: http(paymasterUrl),
                })
                return zerodevPaymaster.sponsorUserOperation({ userOperation, shouldOverrideFee: true })
            },
        }
    } else {
        // Unsponsored: SA pays gas. Bundler's eth_estimateUserOperationGas
        // chokes on userops without maxFee, and viem's default estimation path
        // expects paymaster-filled gas limits. Intercept at sendUserOperation
        // itself — the free-function `prepareUserOperation` in the actions
        // chain bypasses method overrides, but everything goes through
        // `client.sendUserOperation`, so we wrap that. Conservative limits
        // match qa/lib/zerodev.mjs UNSPONSORED_GAS: ~150-300k typical USDC
        // transfer + factory-deploy headroom.
        const kernelClient = createKernelAccountClient(clientConfig)
        const originalSend = kernelClient.sendUserOperation.bind(kernelClient)
        kernelClient.sendUserOperation = (async (args: unknown) => {
            return originalSend({
                ...(args as object),
                callGasLimit: 500_000n,
                verificationGasLimit: 800_000n,
                preVerificationGas: 500_000n,
                // Arb Sepolia public bundler demands >= 0.024 gwei. Use 0.05 for
                // headroom (fee is small in absolute terms on testnet anyway).
                maxFeePerGas: 50_000_000n,
                maxPriorityFeePerGas: 1_000_000n,
            } as never)
        }) as typeof kernelClient.sendUserOperation
        return kernelClient as unknown as GenericSmartAccountClient<C>
    }

    return createKernelAccountClient(clientConfig) as unknown as GenericSmartAccountClient<C>
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

    // Testnet chains don't have ZeroDev UltraRelay — their bundler rejects
    // userops with maxFeePerGas=0 ("must be at least N — use
    // pimlico_getUserOperationGasPrice"). Only use the zero-fee UltraRelay
    // shortcut on mainnet Arb One (42161). On Arb Sepolia (421614) or any
    // other testnet, fall through to standard gas estimation.
    const TESTNET_CHAIN_IDS = new Set([421614, 11155111, 84532])
    const isMainnetPeanutChain =
        chain.id.toString() === PEANUT_WALLET_CHAIN.id.toString() && !TESTNET_CHAIN_IDS.has(chain.id)

    const kernelClient = createKernelAccountClient({
        account: kernelAccount,
        chain: chain,
        bundlerTransport: http(bundlerUrl, { timeout: ZERODEV_RPC_TIMEOUT_MS }),
        pollingInterval: 500,
        userOperation: isMainnetPeanutChain
            ? {
                  // UltraRelay shortcut — Arbitrum One prod only.
                  // https://docs.zerodev.app/sdk/core-api/sponsor-gas#ultrarelay
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
                    transport: http(paymasterUrl, { timeout: ZERODEV_RPC_TIMEOUT_MS }),
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
    // In-flight kernel-client builds keyed by chainId. Lets concurrent
    // ensureClientForChain() callers dedupe to a single build, and lets the
    // primary-init effect register itself so a recover-funds page mount that
    // races primary login doesn't kick off a duplicate Arb build.
    const inFlightRef = useRef<Map<string, Promise<GenericSmartAccountClient>>>(new Map())

    const isAfterZeroDevMigration = useMemo<boolean>(() => {
        if (!user?.user?.createdAt) {
            return true
        }
        return new Date(user.user.createdAt) > ZERODEV_MIGRATION_DATE
    }, [user?.user?.createdAt])

    // lifecycle hooks
    useEffect(() => {
        if (!user?.user.userId) {
            // clear webauthn key and clients when user logs out
            console.log('[KernelClient] No user found, clearing webAuthnKey, clients, and address')
            setWebAuthnKey(undefined)
            setClientsByChain({})
            // Drop any in-flight lazy builds — their results would be useless
            // (and re-applying them would write into a fresh post-logout state).
            inFlightRef.current.clear()
            dispatch(zerodevActions.setAddress(undefined)) // explicitly clear address from redux
            return
        }

        const userPreferences = getUserPreferences(user.user.userId)
        const storedWebAuthnKey = userPreferences?.webAuthnKey ?? getFromCookie(WEB_AUTHN_COOKIE_KEY)
        if (storedWebAuthnKey) {
            // signMessageCallback can't be serialized to cookie/localStorage — it's a function.
            // on web, zerodev recreates it using browser WebAuthn API.
            // on android native, browser WebAuthn doesn't work in the webview — re-attach
            // the native capacitor plugin callback so signing works after restore.
            if (isAndroidNative() && !storedWebAuthnKey.signMessageCallback) {
                const rpId = storedWebAuthnKey.rpID || getNativeRpId()
                // Pin the native signing ceremony to THIS kernel's own credential
                // so a second peanut.me passkey on the device can't be substituted
                // (see createNativeSignMessageCallback + PR #2189).
                storedWebAuthnKey.signMessageCallback = createNativeSignMessageCallback(
                    rpId,
                    storedWebAuthnKey.authenticatorId
                )
            }
            // Only update if the key actually changed to avoid re-triggering kernel client init
            // Note: WebAuthnKey contains BigInt fields (pubX, pubY) which JSON.stringify cannot handle,
            // so we use a custom replacer that converts BigInts to strings for comparison purposes.
            const bigIntSafeStringify = (obj: unknown) =>
                JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
            setWebAuthnKey((prev) =>
                prev && bigIntSafeStringify(prev) === bigIntSafeStringify(storedWebAuthnKey) ? prev : storedWebAuthnKey
            )
        } else if (
            HARNESS_ENABLED &&
            typeof window !== 'undefined' &&
            window.localStorage?.getItem('__harness_skip_passkey') === 'true'
        ) {
            // Harness-only: skip auto-logout so playwright can screenshot the
            // authenticated UI with a seeded user that has no real passkey.
        } else {
            // avoid mixed state
            logoutUser()
        }
    }, [user?.user.userId, logoutUser])

    useEffect(() => {
        if (user?.user.userId && !!webAuthnKey) {
            updateUserPreferences(user.user.userId, { webAuthnKey })
        }
    }, [user?.user.userId, webAuthnKey])

    // Harness-only: when __harness_ecdsa_pk is set in localStorage, bypass the
    // passkey-webAuthnKey path and use an ECDSA validator instead. This is how
    // Playwright drives real userops. Gated on HARNESS_ENABLED (build-time)
    // AND the localStorage flag (runtime) — prod tree-shakes the whole block.
    useEffect(() => {
        if (!HARNESS_ENABLED) return
        if (typeof window === 'undefined') return
        if (window.localStorage?.getItem('__harness_skip_passkey') !== 'true') return
        const pk = window.localStorage.getItem('__harness_ecdsa_pk')
        if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) return
        if (!user?.user.userId) return

        let cancelled = false
        ;(async () => {
            const clients: Record<string, GenericSmartAccountClient> = {}
            for (const [chainId, { client, chain, bundlerUrl, paymasterUrl }] of Object.entries(
                PUBLIC_CLIENTS_BY_CHAIN
            )) {
                try {
                    const kernelClient = await createHarnessEcdsaKernelClient(client, chain, pk as `0x${string}`, {
                        bundlerUrl,
                        paymasterUrl,
                    })
                    clients[chainId] = kernelClient
                } catch (e) {
                    console.error(`[harness] ECDSA kernel init failed for chain ${chainId}:`, e)
                }
            }
            if (cancelled) return
            if (!clients[PEANUT_WALLET_CHAIN.id.toString()]) {
                console.error('[harness] primary ECDSA kernel client failed')
                return
            }
            setClientsByChain(clients)
            dispatch(zerodevActions.setIsKernelClientReady(true))
            dispatch(zerodevActions.setIsRegistering(false))
            dispatch(zerodevActions.setIsLoggingIn(false))
        })()
        return () => {
            cancelled = true
        }
    }, [user?.user.userId])

    useEffect(() => {
        let isMounted = true

        if (!webAuthnKey) {
            return () => {
                isMounted = false
            }
        }

        const initializeClients = async () => {
            // Recovery chains (mainnet/base/linea) are lazy-built via
            // ensureClientForChain — only /recover-funds needs them.
            const primaryChainId = PEANUT_WALLET_CHAIN.id.toString()
            const entry = PUBLIC_CLIENTS_BY_CHAIN[primaryChainId]
            if (!entry) {
                throw new Error(`Primary chain ${primaryChainId} missing from PUBLIC_CLIENTS_BY_CHAIN`)
            }

            // Register in inFlightRef so a concurrent ensureClientForChain
            // (e.g. route mounted before login completes) dedupes here.
            const buildPromise = createKernelClientForChain(
                entry.client,
                entry.chain,
                isAfterZeroDevMigration,
                webAuthnKey,
                isAfterZeroDevMigration
                    ? undefined
                    : (user?.accounts.find((a) => a.type === AccountType.PEANUT_WALLET)?.identifier as
                          | Address
                          | undefined),
                { bundlerUrl: entry.bundlerUrl, paymasterUrl: entry.paymasterUrl }
            )
            inFlightRef.current.set(primaryChainId, buildPromise as Promise<GenericSmartAccountClient>)

            let kernelClient: GenericSmartAccountClient
            try {
                kernelClient = (await buildPromise) as GenericSmartAccountClient
            } finally {
                inFlightRef.current.delete(primaryChainId)
            }

            // Guard: the restored WebAuthnKey must belong to the logged-in user.
            // On a shared device with two Peanut accounts (two passkeys for the
            // same RP), the restore path can pair this session with the OTHER
            // account's credential. The derived kernel address then differs from
            // the user's real smart-wallet address, and any server-bound ERC-1271
            // check (Rain card withdraw) rejects the signature as "invalid admin
            // signature". Purge the poisoned key and force a clean re-auth rather
            // than silently signing with the wrong credential. Skipped when the
            // user has no smart-wallet account yet (mid-registration) and for
            // pre-migration users (address is passed in, so it always matches).
            const expectedAddress = user?.accounts.find((a) => a.type === AccountType.PEANUT_WALLET)?.identifier
            const derivedAddress = kernelClient.account?.address
            if (expectedAddress && derivedAddress && derivedAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
                console.error('[KernelClient] restored WebAuthnKey does not match the logged-in user — purging', {
                    userId: user?.user.userId,
                    derivedAddress,
                    expectedAddress,
                })
                if (user?.user.userId) updateUserPreferences(user.user.userId, { webAuthnKey: undefined })
                logoutUser()
                return
            }

            // Only update state after primary succeeds — avoids
            // registering→not→registering UI flicker between retries.
            if (isMounted) {
                setClientsByChain((prev) => ({ ...prev, [primaryChainId]: kernelClient }))
                fetchUser()
                dispatch(zerodevActions.setIsKernelClientReady(true))
                dispatch(zerodevActions.setIsRegistering(false))
                dispatch(zerodevActions.setIsLoggingIn(false))
            }
        }

        retryAsync(initializeClients, { maxRetries: 2, baseDelay: 1000, maxDelay: 5000 }).catch(() => {
            if (isMounted) {
                console.error('[KernelClient] Primary chain client failed after retries — forcing logout')
                dispatch(zerodevActions.setIsRegistering(false))
                dispatch(zerodevActions.setIsLoggingIn(false))
                logoutUser()
            }
        })

        return () => {
            isMounted = false
        }
        // Intentionally excluding `user` from deps: `useUserQuery` refetches on
        // window focus / mount and produces new refs on any content change
        // (invites, KYC status, JWT sliding refresh). Adding `user` here would
        // rebuild the Arb kernel on every such refetch — and since the effect
        // calls fetchUser() at the end, it can self-trigger into a loop. The
        // closure reads user.accounts.find('peanut-wallet').identifier, which
        // is stable for an authenticated user, and isAfterZeroDevMigration
        // captures any user.createdAt change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [webAuthnKey, isAfterZeroDevMigration])

    useEffect(() => {
        const peanutClient = clientsByChain[PEANUT_WALLET_CHAIN.id]
        if (peanutClient) {
            dispatch(zerodevActions.setAddress(peanutClient.account!.address))
        }
    }, [clientsByChain])

    // Refuse to hand out a kernel client whose smart-account address doesn't
    // match the logged-in user, then force a clean re-auth. On a shared device
    // with two passkeys for the same RP, the restore path can pair this session
    // with the OTHER account's credential; signing with it yields a wrong-owner
    // signature the EntryPoint rejects (AA24) — or Rain's ERC-1271 check rejects
    // as invalid admin signature. Every sign site reads through here, so one
    // check covers them all (and the next one written). Skipped when the user
    // has no smart-wallet account yet (mid-registration); also a no-op for
    // pre-migration accounts, whose address is injected rather than derived from
    // the key, so a mismatch can't be detected here for them.
    const assertClientOwnedByUser = useCallback(
        (client: GenericSmartAccountClient): GenericSmartAccountClient => {
            const expectedAddress = user?.accounts.find((a) => a.type === AccountType.PEANUT_WALLET)?.identifier
            const derivedAddress = client.account?.address
            if (isStaleClientForUser(derivedAddress, expectedAddress)) {
                console.error('[KernelClient] active client does not match logged-in user — forcing logout', {
                    userId: user?.user.userId,
                    derivedAddress,
                    expectedAddress,
                })
                if (user?.user.userId) updateUserPreferences(user.user.userId, { webAuthnKey: undefined })
                logoutUser()
                throw createStaleSessionError()
            }
            return client
        },
        [user, logoutUser]
    )

    const getClientForChain = useCallback(
        (chainId: string) => {
            const client = clientsByChain[chainId]
            if (!client) {
                const availableChains = Object.keys(clientsByChain).join(', ')
                console.error(
                    `[KernelClient] No client found for chain ${chainId}. Available chains: ${availableChains || 'none'}`
                )
                throw new Error(
                    `No client found for chain ${chainId}. This chain may not be configured for wallet operations.`
                )
            }
            return assertClientOwnedByUser(client)
        },
        [clientsByChain, assertClientOwnedByUser]
    )

    const ensureClientForChain = useCallback(
        async (chainId: string): Promise<GenericSmartAccountClient> => {
            const cached = clientsByChain[chainId]
            if (cached) return assertClientOwnedByUser(cached)

            const inFlight = inFlightRef.current.get(chainId)
            if (inFlight) return inFlight.then(assertClientOwnedByUser)

            if (!webAuthnKey) {
                throw new Error(`Cannot build kernel client for chain ${chainId}: not authenticated`)
            }
            const entry = PUBLIC_CLIENTS_BY_CHAIN[chainId]
            if (!entry) {
                throw new Error(
                    `No PUBLIC_CLIENTS_BY_CHAIN entry for chain ${chainId} — chain not configured for wallet operations`
                )
            }

            const promise = createKernelClientForChain(
                entry.client,
                entry.chain,
                isAfterZeroDevMigration,
                webAuthnKey,
                isAfterZeroDevMigration
                    ? undefined
                    : (user?.accounts.find((a) => a.type === AccountType.PEANUT_WALLET)?.identifier as
                          | Address
                          | undefined),
                { bundlerUrl: entry.bundlerUrl, paymasterUrl: entry.paymasterUrl }
            )
                .then((kernelClient) => {
                    setClientsByChain((prev) => ({ ...prev, [chainId]: kernelClient }))
                    return assertClientOwnedByUser(kernelClient)
                })
                .catch((error) => {
                    console.error(`Error lazy-building kernel client for chain ${chainId}:`, error)
                    if (isStaleKeyError(error)) {
                        logoutUser()
                    } else {
                        captureException(error)
                    }
                    throw error
                })
                .finally(() => {
                    inFlightRef.current.delete(chainId)
                })

            inFlightRef.current.set(chainId, promise)
            return promise
        },
        [clientsByChain, webAuthnKey, isAfterZeroDevMigration, user, assertClientOwnedByUser, logoutUser]
    )

    return (
        <KernelClientContext.Provider
            value={{
                setWebAuthnKey,
                getClientForChain,
                ensureClientForChain,
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

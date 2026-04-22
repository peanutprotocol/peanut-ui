'use client'

import { useCallback, useState } from 'react'
import type { Address, Hex, LocalAccount } from 'viem'
import { pad, parseAbi, toFunctionSelector } from 'viem'
import { useKernelClient } from '@/context/kernelClient.context'
import { useRainCardOverview, RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { useQueryClient } from '@tanstack/react-query'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { rainCoordinatorAbi } from '@/constants/rain.consts'
import { toPermissionValidator } from '@zerodev/permissions'
import { toCallPolicy, CallPolicyVersion, ParamCondition } from '@zerodev/permissions/policies'
import { toECDSASigner } from '@zerodev/permissions/signers'
import { createKernelAccount } from '@zerodev/sdk'
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { serializePermissionAccount } from '@zerodev/permissions'
import { peanutPublicClient } from '@/app/actions/clients'
import { rainApi } from '@/services/rain'

/**
 * One-time session-key grant for Rain card operations.
 *
 * Installs two `CallPolicy` entries on the user's kernel in a single
 * passkey tap:
 *   - `USDC.transfer(collateralProxy, *)` — auto-balancer deposits
 *   - `coordinator.withdrawAsset(coordinator, *)` — user-initiated withdrawals
 *
 * After the grant, the backend can submit UserOps for either operation
 * using the shared session key without another passkey tap — per-spend
 * authorization still comes from the user via the admin EIP-712 signature
 * (which the coordinator verifies against the kernel via ERC-1271).
 *
 * Consumers: dev grant page, production activation UI, and `useSpendBundle`
 * for the lazy "first collateral spend prompts for grant" flow.
 */

/**
 * Frontend doesn't hold the session-key private key (backend does).
 * `toECDSASigner` only reads `.address` off the signer for permission
 * install, so a minimal LocalAccount that throws on any sign attempt
 * is sufficient and protects against misuse.
 */
function remoteSignerByAddress(address: Address): LocalAccount {
    const throwSign = () => {
        throw new Error('Session-key remote signer cannot sign on the frontend — backend owns the private key')
    }
    return {
        address,
        type: 'local',
        source: 'remote-session-key',
        publicKey: '0x' as Hex,
        signMessage: throwSign as any,
        signTransaction: throwSign as any,
        signTypedData: throwSign as any,
    } as unknown as LocalAccount
}

export type GrantSessionKeyError =
    | { kind: 'no-card' }
    | { kind: 'no-contracts' }
    | { kind: 'session-key-unavailable'; message: string }
    | { kind: 'user-cancelled' }
    | { kind: 'unexpected'; message: string }

export interface GrantSessionKeyResult {
    /** Full grant: passkey tap + POST to `/session-approve`. Requires an
     *  active card; use for the lazy "first collateral spend" flow. */
    grant: () => Promise<{ ok: true } | { ok: false; error: GrantSessionKeyError }>
    /** Passkey tap only — returns the serialized approval string without
     *  submitting it. Use when the card doesn't exist yet (issuance) and
     *  another endpoint stores the string (e.g. `POST /rain/cards`). */
    serializeGrant: () => Promise<{ ok: true; serialized: string } | { ok: false; error: GrantSessionKeyError }>
    isGranting: boolean
    lastError: GrantSessionKeyError | null
}

export const useGrantSessionKey = (): GrantSessionKeyResult => {
    const { overview, refetch } = useRainCardOverview()
    const { getClientForChain } = useKernelClient()
    const queryClient = useQueryClient()
    const [isGranting, setIsGranting] = useState(false)
    const [lastError, setLastError] = useState<GrantSessionKeyError | null>(null)

    /**
     * Shared passkey + serialize step. Produces the serialized permission
     * string but does NOT hit any backend endpoint. Requires the collateral
     * proxy + coordinator addresses (available once Rain has approved KYC).
     */
    const runSerialize = useCallback(async (): Promise<
        { ok: true; serialized: string } | { ok: false; error: GrantSessionKeyError }
    > => {
        const collateralProxy = overview?.status?.contractAddress as Address | undefined
        const coordinatorAddress = overview?.status?.coordinatorAddress as Address | undefined
        if (!collateralProxy || !coordinatorAddress) {
            return { ok: false, error: { kind: 'no-contracts' } }
        }

        let sessionKeyAddress: Address
        try {
            const { address } = await rainApi.getSessionKeyAddress()
            sessionKeyAddress = address as Address
        } catch (e) {
            return { ok: false, error: { kind: 'session-key-unavailable', message: (e as Error).message } }
        }

        // Single CallPolicy with BOTH allowed calls. Multiple policies in
        // `toPermissionValidator` are AND'd (a UserOp must satisfy every
        // policy) — putting both permissions inside ONE call policy OR's
        // them, so either transfer OR withdrawAsset is allowed.
        //
        // - USDC.transfer(collateralProxy, *) — auto-balancer deposits.
        //   `params` is bytes32[] even for a single EQUAL rule; pad address to 32 bytes.
        // - coordinator.withdrawAsset(*) — user-initiated withdrawals.
        //   No param rules: the per-spend admin EIP-712 signature the user
        //   produces via passkey gates recipient/amount on every call.
        const rainCallPolicy = await toCallPolicy({
            policyVersion: CallPolicyVersion.V0_0_4,
            permissions: [
                {
                    target: PEANUT_WALLET_TOKEN as Address,
                    selector: toFunctionSelector(parseAbi(['function transfer(address,uint256) returns (bool)'])[0]),
                    rules: [
                        {
                            condition: ParamCondition.EQUAL,
                            offset: 0,
                            params: [pad(collateralProxy, { size: 32 })],
                        },
                    ],
                },
                {
                    target: coordinatorAddress,
                    selector: toFunctionSelector(rainCoordinatorAbi[0] as any),
                },
            ],
        })

        const sessionKeySigner = await toECDSASigner({
            signer: remoteSignerByAddress(sessionKeyAddress),
        })
        const permissionPlugin = await toPermissionValidator(peanutPublicClient, {
            entryPoint: getEntryPoint('0.7'),
            kernelVersion: KERNEL_V3_1,
            signer: sessionKeySigner,
            policies: [rainCallPolicy],
        })

        const chainId = PEANUT_WALLET_CHAIN.id.toString()
        const kernelClient = getClientForChain(chainId)
        // Triggers the passkey prompt — this is the one-time install.
        const sessionKernelAccount = await createKernelAccount(peanutPublicClient, {
            entryPoint: getEntryPoint('0.7'),
            kernelVersion: KERNEL_V3_1,
            plugins: {
                sudo: (kernelClient.account as any).kernelPluginManager.sudoValidator,
                regular: permissionPlugin,
            },
        })

        const serialized = await serializePermissionAccount(sessionKernelAccount)
        return { ok: true, serialized }
    }, [overview, getClientForChain])

    const wrap = useCallback(
        async <T>(
            run: () => Promise<{ ok: true; value?: T } | { ok: false; error: GrantSessionKeyError }>
        ): Promise<{ ok: true; value?: T } | { ok: false; error: GrantSessionKeyError }> => {
            setIsGranting(true)
            setLastError(null)
            try {
                const result = await run()
                if (!result.ok) setLastError(result.error)
                return result
            } catch (err) {
                const message = (err as Error).message ?? String(err)
                const kind: GrantSessionKeyError['kind'] =
                    message.toLowerCase().includes('user rejected') || message.toLowerCase().includes('cancelled')
                        ? 'user-cancelled'
                        : 'unexpected'
                const error: GrantSessionKeyError =
                    kind === 'user-cancelled' ? { kind: 'user-cancelled' } : { kind: 'unexpected', message }
                setLastError(error)
                return { ok: false, error }
            } finally {
                setIsGranting(false)
            }
        },
        []
    )

    const serializeGrant = useCallback<GrantSessionKeyResult['serializeGrant']>(async () => {
        const result = await wrap(async () => {
            const r = await runSerialize()
            return r.ok ? { ok: true, value: r.serialized } : r
        })
        if (result.ok) return { ok: true, serialized: result.value as string }
        return result
    }, [wrap, runSerialize])

    const grant = useCallback<GrantSessionKeyResult['grant']>(async () => {
        const result = await wrap(async () => {
            const card = overview?.cards?.[0]
            if (!card) return { ok: false, error: { kind: 'no-card' } as const }

            const r = await runSerialize()
            if (!r.ok) return r

            try {
                await rainApi.submitWithdrawSessionApproval({ serializedApproval: r.serialized })
            } catch (e) {
                return { ok: false, error: { kind: 'unexpected', message: (e as Error).message } as const }
            }

            // Flip the `hasWithdrawApproval` flag in UI by refetching overview.
            await refetch()
            queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
            return { ok: true as const }
        })
        if (result.ok) return { ok: true }
        return result
    }, [wrap, runSerialize, overview, refetch, queryClient])

    return { grant, serializeGrant, isGranting, lastError }
}

'use client'

import { useCallback, useState } from 'react'
import type { Address, Hex, LocalAccount } from 'viem'
import { pad, parseAbi, toFunctionSelector } from 'viem'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useKernelClient } from '@/context/kernelClient.context'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useRainCardOverview, RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { useQueryClient } from '@tanstack/react-query'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { rainCoordinatorAbi } from '@/constants/rain.consts'
import { toPermissionValidator } from '@zerodev/permissions'
import { toCallPolicy, CallPolicyVersion, ParamCondition } from '@zerodev/permissions/policies'
import { toECDSASigner } from '@zerodev/permissions/signers'
import { accountMetadata, createKernelAccount, getPluginsEnableTypedData, KernelV3AccountAbi } from '@zerodev/sdk'
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { serializePermissionAccount } from '@zerodev/permissions'
import { peanutPublicClient } from '@/app/actions/clients'
import { rainApi } from '@/services/rain'

/** Minimal structural view of the bits of the kernel account's plugin manager
 *  this flow touches. The SDK doesn't surface these on its public account type,
 *  so we model just what we use rather than reaching through `any`.
 *  `getAction`/`hook` are typed from `getPluginsEnableTypedData`'s own
 *  parameter so the enable-typed-data call stays fully checked. */
type EnableTypedDataParams = Parameters<typeof getPluginsEnableTypedData>[0]
type KernelAccountInternals = {
    kernelPluginManager: {
        getAction: () => EnableTypedDataParams['action']
        hook: EnableTypedDataParams['hook']
    }
}

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
     *  active card; use for the lazy "first collateral spend" flow.
     *  `overviewFresh` is false when the grant itself succeeded but the
     *  follow-up overview refetch failed (react-query refetch resolves with
     *  an error state instead of throwing) — consumers must NOT read the
     *  still-stale `hasWithdrawApproval` as a lockout signal in that case. */
    grant: () => Promise<{ ok: true; overviewFresh: boolean } | { ok: false; error: GrantSessionKeyError }>
    /** Passkey tap only — returns the serialized approval string without
     *  submitting it. Use when the card doesn't exist yet (issuance) and
     *  another endpoint stores the string (e.g. `POST /rain/cards`). */
    serializeGrant: () => Promise<{ ok: true; serialized: string } | { ok: false; error: GrantSessionKeyError }>
    isGranting: boolean
    lastError: GrantSessionKeyError | null
}

export const useGrantSessionKey = (): GrantSessionKeyResult => {
    const { overview, refetch } = useRainCardOverview()
    const { getClientForChain, getPatchedSudoValidator } = useKernelClient()
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
        // Fired here (not at wrap-entry) so the denominator excludes the
        // 'no-contracts' / 'session-key-unavailable' early returns that never
        // produce a passkey prompt.
        posthog.capture(ANALYTICS_EVENTS.CARD_SESSION_KEY_PROMPTED)
        // The serialized approval's sudo plugin MUST bind to the v0.0.3 PATCHED
        // validator. Do NOT read `kernelClient.account.kernelPluginManager
        // .sudoValidator`: for a pre-2025-09-18 (migrated) user that resolves to
        // the STALE v0.0.2 validator the migration client was constructed with
        // (`sudo: fromValidator`), so the backend's replayed sweep/withdraw
        // userOp gets wapk-403'd by ZeroDev's paymaster. `getPatchedSudoValidator`
        // is the single source of truth — the same v0.0.3 validator the migration
        // client migrates *to* — so the approval binds correctly for every user.
        const patchedSudoValidator = await getPatchedSudoValidator(peanutPublicClient)

        // Triggers the passkey prompt — this is the one-time install.
        // `address` is forced to the user's actual wallet so the approval
        // binds to the deployed kernel. Pre-2025-09-18 users sit at a
        // legacy V0_0_2-derived address (migrated in place to V0_0_3); the
        // natural counterfactual of `createKernelAccount({sudo: patchedSudoValidator})`
        // is a different, never-funded address. Forcing the address here makes
        // the grant work for both legacy and post-migration users.
        const accountAddress = kernelClient.account!.address
        // The three on-chain reads only need the (already-known) account address,
        // so they run alongside the account construction.
        const [sessionKernelAccount, bytecode, metadata, nonceRead] = await Promise.all([
            createKernelAccount(peanutPublicClient, {
                address: accountAddress,
                entryPoint: getEntryPoint('0.7'),
                kernelVersion: KERNEL_V3_1,
                plugins: {
                    sudo: patchedSudoValidator,
                    regular: permissionPlugin,
                },
            }),
            peanutPublicClient.getCode({ address: accountAddress }),
            // Live on-chain EIP-712 domain version, KERNEL_V3_1 fallback when the
            // account can't report one — the same resolution the SDK's internal
            // enable path uses (a hardcoded version signs the wrong domain for any
            // kernel not exactly on that version).
            accountMetadata(peanutPublicClient, accountAddress, KERNEL_V3_1, PEANUT_WALLET_CHAIN.id),
            peanutPublicClient
                .readContract({ address: accountAddress, abi: KernelV3AccountAbi, functionName: 'currentNonce' })
                .then(
                    (nonce) => ({ read: true as const, nonce: Number(nonce) }),
                    (error: unknown) => ({ read: false as const, error })
                ),
        ])

        // The session-key permission installs on-chain via an "enable" approval the
        // passkey signs here, bound to the account's `currentNonce` — the kernel
        // rejects the enable with `AA23 InvalidNonce` if the signed value ≠ its live
        // value, and the grant still "succeeds", so the card then declines forever.
        // The SDK's internal `getKernelV3Nonce` silently falls back to `1` on ANY
        // read failure, which mints exactly that broken approval for accounts whose
        // live nonce ≠ 1 (e.g. migrated / sudo-changed accounts). Bind to the
        // verified live nonce instead, and only fall back where 1 is provably
        // correct: a counterfactual account, whose kernel initializes
        // `currentNonce` to 1 at deployment (the read itself reverts pre-deploy).
        let validatorNonce: number
        if (!bytecode) {
            validatorNonce = 1
        } else if (!nonceRead.read) {
            // Deployed but unreadable: fail LOUDLY rather than sign a guess.
            throw nonceRead.error
        } else {
            // A deployed-but-uninitialized proxy reports 0; enables validate
            // against ≥1 post-init, so normalize the way the SDK does.
            validatorNonce = nonceRead.nonce === 0 ? 1 : nonceRead.nonce
        }

        const pm = (sessionKernelAccount as unknown as KernelAccountInternals).kernelPluginManager
        const enableTypedData = await getPluginsEnableTypedData({
            accountAddress: sessionKernelAccount.address,
            chainId: PEANUT_WALLET_CHAIN.id,
            kernelVersion: metadata.version,
            action: pm.getAction(),
            hook: pm.hook,
            validator: permissionPlugin,
            validatorNonce,
        })
        // Same sudo validator + signing path the SDK uses internally, so for
        // healthy nonce=1 accounts this yields an identical approval.
        const enableSignature = await patchedSudoValidator.signTypedData(enableTypedData)

        const serialized = await serializePermissionAccount(sessionKernelAccount, undefined, enableSignature)
        return { ok: true, serialized }
    }, [overview, getClientForChain, getPatchedSudoValidator])

    const wrap = useCallback(
        async <T>(
            run: () => Promise<{ ok: true; value?: T } | { ok: false; error: GrantSessionKeyError }>
        ): Promise<{ ok: true; value?: T } | { ok: false; error: GrantSessionKeyError }> => {
            setIsGranting(true)
            setLastError(null)
            try {
                const result = await run()
                if (result.ok) {
                    posthog.capture(ANALYTICS_EVENTS.CARD_SESSION_KEY_GRANTED)
                } else {
                    setLastError(result.error)
                    posthog.capture(ANALYTICS_EVENTS.CARD_SESSION_KEY_FAILED, { kind: result.error.kind })
                }
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
                posthog.capture(ANALYTICS_EVENTS.CARD_SESSION_KEY_FAILED, { kind })
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
            const card = findActiveCard(overview)
            if (!card) return { ok: false, error: { kind: 'no-card' } as const }

            const r = await runSerialize()
            if (!r.ok) return r

            try {
                await rainApi.submitWithdrawSessionApproval({ serializedApproval: r.serialized })
            } catch (e) {
                return { ok: false, error: { kind: 'unexpected', message: (e as Error).message } as const }
            }

            // Flip the `hasWithdrawApproval` flag in UI by refetching overview.
            // refetch() resolves (never throws) with an error state on network
            // failure — surface that so the caller can tell "flag is stale"
            // apart from "flag genuinely didn't flip".
            const refetchResult = await refetch()
            queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
            return { ok: true as const, value: refetchResult.isSuccess }
        })
        if (result.ok) return { ok: true, overviewFresh: result.value === true }
        return result
    }, [wrap, runSerialize, overview, refetch, queryClient])

    return { grant, serializeGrant, isGranting, lastError }
}

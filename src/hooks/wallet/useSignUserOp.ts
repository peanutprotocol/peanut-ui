'use client'

import { useCallback } from 'react'
import { withCeremonyPurpose } from '@/utils/webauthn-ceremony-telemetry'
import { useKernelClient } from '@/context/kernelClient.context'
import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    USER_OP_ENTRY_POINT,
} from '@/constants/zerodev.consts'
import { parseUnits, encodeFunctionData, erc20Abi, isAddress, isHex } from 'viem'
import type { Hex, Address } from 'viem'
import { captureException } from '@sentry/nextjs'
import { capturePasskeySignFailure } from '@/utils/webauthn.utils'
import {
    preparedSmartSpendStaleness,
    type PreparedSmartSpend,
    type SmartSpendCall,
    type UnsignedUserOperation,
} from './smartSpendPreparation'
import { PAYMASTER_PREVIEW_CONTEXT } from './paymasterSponsorship'

export interface SignedUserOpData {
    signedUserOp: UnsignedUserOperation & { signature: Hex }
    chainId: string
    entryPointAddress: Address
}

/** Whether Pay signed the candidate prepared ahead of time or rebuilt the op. */
export type UserOpPreparationOrigin = 'reused' | 'fresh'

export interface SignCallsUserOpOptions {
    /** Candidate built before Pay by `useSmartSpendPreparation` (previewed,
     *  never consuming). Signed only if it is still for this client, these
     *  calls and a live lock and its nonce still matches on-chain; then ONE
     *  consuming sponsorship is taken for it. Otherwise the op is rebuilt from
     *  scratch — same as with no candidate — and only that rebuild consumes. */
    prepared?: PreparedSmartSpend | null
    /** Fires once the unsigned op is final, right before the passkey ceremony. */
    onPrepared?: (origin: UserOpPreparationOrigin) => void
}

type KernelClient = ReturnType<ReturnType<typeof useKernelClient>['getClientForChain']>

/** What the ZeroDev paymaster returns for an EntryPoint 0.7 sponsorship. */
interface SponsorshipRefresh {
    paymaster: Address
    paymasterData: Hex
    paymasterVerificationGasLimit: bigint
    paymasterPostOpGasLimit: bigint
    callGasLimit: bigint
    verificationGasLimit: bigint
    preVerificationGas: bigint
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
}

const isBigint = (value: unknown): value is bigint => typeof value === 'bigint'

/**
 * Narrow the paymaster response at runtime. A sponsorship with a missing or
 * malformed field is not "probably fine" and must never be merged into the op.
 */
function toSponsorshipRefresh(value: unknown): SponsorshipRefresh | null {
    if (!value || typeof value !== 'object') return null
    const v = value as Record<string, unknown>
    if (typeof v.paymaster !== 'string' || !isAddress(v.paymaster, { strict: false })) return null
    if (typeof v.paymasterData !== 'string' || !isHex(v.paymasterData)) return null
    const gas = [
        v.paymasterVerificationGasLimit,
        v.paymasterPostOpGasLimit,
        v.callGasLimit,
        v.verificationGasLimit,
        v.preVerificationGas,
    ]
    if (!gas.every(isBigint)) return null
    if (v.maxFeePerGas !== undefined && !isBigint(v.maxFeePerGas)) return null
    if (v.maxPriorityFeePerGas !== undefined && !isBigint(v.maxPriorityFeePerGas)) return null
    return {
        paymaster: v.paymaster,
        paymasterData: v.paymasterData,
        paymasterVerificationGasLimit: v.paymasterVerificationGasLimit as bigint,
        paymasterPostOpGasLimit: v.paymasterPostOpGasLimit as bigint,
        callGasLimit: v.callGasLimit as bigint,
        verificationGasLimit: v.verificationGasLimit as bigint,
        preVerificationGas: v.preVerificationGas as bigint,
        ...(v.maxFeePerGas !== undefined ? { maxFeePerGas: v.maxFeePerGas as bigint } : {}),
        ...(v.maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas: v.maxPriorityFeePerGas as bigint } : {}),
    }
}

type PaymasterConfig = Exclude<NonNullable<KernelClient['paymaster']>, true>
type PaymasterCallbacks = { getPaymasterData: NonNullable<PaymasterConfig['getPaymasterData']> }

function paymasterCallbacks(client: KernelClient): PaymasterCallbacks | null {
    const paymaster = client.paymaster
    if (!paymaster || paymaster === true || typeof paymaster.getPaymasterData !== 'function') return null
    return paymaster as PaymasterCallbacks
}

/**
 * The ONE consuming sponsorship for a reused candidate. The installed ZeroDev
 * SDK returns `paymasterData` as an opaque blob for EntryPoint 0.7 (no
 * validUntil / validAfter are exposed), so the client cannot prove the
 * warmup's preview sponsorship is still valid — a TTL guess is not proof. Ask
 * the paymaster again for the SAME op, this time consuming the policy; it
 * re-estimates gas and re-signs. Same callback and request shape viem's
 * prepareUserOperation uses (stub signature included), with the client's own
 * context, i.e. no preview marker.
 *
 * Past this call the policy may have been consumed even if the answer never
 * arrives, so nothing here is swallowed: the caller must not follow it with
 * another consuming request on its own.
 */
async function consumeSponsorship(
    paymaster: PaymasterCallbacks,
    client: KernelClient,
    userOperation: UnsignedUserOperation,
    chainId: string
): Promise<SponsorshipRefresh> {
    const response = await paymaster.getPaymasterData({
        chainId: Number(chainId),
        entryPointAddress: USER_OP_ENTRY_POINT.address,
        context: client.paymasterContext,
        ...userOperation,
    } as Parameters<PaymasterCallbacks['getPaymasterData']>[0])
    const sponsorship = toSponsorshipRefresh(response)
    if (!sponsorship) throw new Error('useSignUserOp: malformed sponsorship response after consuming the policy')
    return sponsorship
}

type SponsorshipMode = 'preview' | 'consume'

/**
 * The harmless half of signing: encode the calls and let viem fill nonce,
 * factory args, gas and paymaster sponsorship. The bundler and paymaster do
 * receive the unsigned op for estimation and sponsorship, but nothing is
 * signed and nothing is broadcast — no passkey prompt, no on-chain state change.
 * viem invokes the single configured paymaster callback once. In `preview`
 * mode the request carries the preview marker, so that call sponsors WITHOUT
 * consuming the policy; in `consume` mode it consumes exactly once, as before.
 * Bound to ONE client: the account that prepared is the account that signs.
 */
async function prepareWithClient(
    client: KernelClient,
    calls: SmartSpendCall[],
    chainId: string,
    mode: SponsorshipMode
): Promise<Omit<PreparedSmartSpend, 'lockCode' | 'lockExpiresAtMs'>> {
    const account = client.account
    if (!account) {
        throw new Error('Smart account not initialized')
    }
    const callData = await account.encodeCalls(calls)
    const userOperation = (await client.prepareUserOperation({
        account,
        callData,
        ...(mode === 'preview' ? { paymasterContext: PAYMASTER_PREVIEW_CONTEXT } : {}),
    })) as UnsignedUserOperation
    return {
        client,
        chainId,
        entryPointAddress: USER_OP_ENTRY_POINT.address,
        accountAddress: account.address,
        calls,
        userOperation,
    }
}

type ReuseOutcome = { kind: 'stale' } | { kind: 'ready'; userOperation: UnsignedUserOperation }
const STALE: ReuseOutcome = { kind: 'stale' }

/**
 * Turns a pre-Pay candidate into a signable op, or reports it stale so the
 * caller rebuilds: wrong client/calls/lock, unsponsored client, or nonce
 * moved on-chain. Every stale verdict is reached BEFORE any policy use, so a
 * rebuild never doubles up. The consuming sponsorship comes last and its
 * failures propagate (see `consumeSponsorship`).
 */
async function reusePreparedUserOp(
    client: KernelClient,
    prepared: PreparedSmartSpend,
    calls: SmartSpendCall[],
    chainId: string
): Promise<ReuseOutcome> {
    if (preparedSmartSpendStaleness(prepared, { client, chainId, calls, now: Date.now() })) return STALE
    const paymaster = paymasterCallbacks(client)
    if (!paymaster) return STALE
    // A read; the full prepare re-reads it anyway, so a failure here is stale.
    let nonce: bigint
    try {
        nonce = await client.account!.getNonce()
    } catch {
        return STALE
    }
    if (nonce !== prepared.userOperation.nonce) return STALE
    const sponsorship = await consumeSponsorship(paymaster, client, prepared.userOperation, chainId)
    return {
        kind: 'ready',
        userOperation: {
            ...prepared.userOperation,
            paymaster: sponsorship.paymaster,
            paymasterData: sponsorship.paymasterData,
            paymasterVerificationGasLimit: sponsorship.paymasterVerificationGasLimit,
            paymasterPostOpGasLimit: sponsorship.paymasterPostOpGasLimit,
            callGasLimit: sponsorship.callGasLimit,
            verificationGasLimit: sponsorship.verificationGasLimit,
            preVerificationGas: sponsorship.preVerificationGas,
            ...(sponsorship.maxFeePerGas !== undefined ? { maxFeePerGas: sponsorship.maxFeePerGas } : {}),
            ...(sponsorship.maxPriorityFeePerGas !== undefined
                ? { maxPriorityFeePerGas: sponsorship.maxPriorityFeePerGas }
                : {}),
        },
    }
}

/**
 * Hook to sign UserOperations without broadcasting them to the network.
 * This allows for a two-phase commit pattern where the transaction is signed first,
 * then submitted from the backend after confirming external dependencies (e.g., Manteca payment).
 */
export const useSignUserOp = () => {
    const { getClientForChain } = useKernelClient()

    /** Ahead-of-Pay preview against the current client: no policy use. See `prepareWithClient`. */
    const prepareCallsUserOp = useCallback(
        (calls: SmartSpendCall[], chainId: string = PEANUT_WALLET_CHAIN.id.toString()) =>
            prepareWithClient(getClientForChain(chainId), calls, chainId, 'preview'),
        [getClientForChain]
    )

    /**
     * Signs a UserOperation containing arbitrary kernel calls without
     * broadcasting it. Used by sign-then-broadcast flows (Manteca) where the
     * backend gates the broadcast on an external precondition.
     *
     * The client is resolved ONCE here and used for candidate validation, the
     * fallback prepare and the signature alike. A client rebuilt mid-call
     * (root-validator migration, re-login) is picked up by the NEXT call; the
     * previous SDK path bound one account to prepare+sign the same way.
     */
    const signCallsUserOp = useCallback(
        async (
            calls: SmartSpendCall[],
            chainId: string = PEANUT_WALLET_CHAIN.id.toString(),
            options?: SignCallsUserOpOptions
        ): Promise<SignedUserOpData> => {
            try {
                const client = getClientForChain(chainId)
                const account = client.account
                if (!account) {
                    throw new Error('Smart account not initialized')
                }
                // Exactly one consuming sponsorship per signed op: either the
                // candidate's (after the nonce re-read agrees) or the fresh
                // prepare's single callback call — never both.
                const reuse: ReuseOutcome = options?.prepared
                    ? await reusePreparedUserOp(client, options.prepared, calls, chainId)
                    : STALE
                const origin: UserOpPreparationOrigin = reuse.kind === 'ready' ? 'reused' : 'fresh'
                const userOperation =
                    reuse.kind === 'ready'
                        ? reuse.userOperation
                        : (await prepareWithClient(client, calls, chainId, 'consume')).userOperation
                options?.onPrepared?.(origin)
                // Same split as useZeroDev: the signature is the only ceremony.
                const signature = (await withCeremonyPurpose('user_op', () =>
                    account.signUserOperation(userOperation as Parameters<typeof account.signUserOperation>[0])
                )) as Hex
                return {
                    signedUserOp: { ...userOperation, signature },
                    chainId,
                    entryPointAddress: USER_OP_ENTRY_POINT.address,
                }
            } catch (error) {
                console.error('[useSignUserOp] Error signing calls UserOperation:', error)
                capturePasskeySignFailure(error, 'sign-user-op')
                captureException(error, {
                    tags: { feature: 'sign-user-op' },
                    extra: { callCount: calls.length, chainId },
                })
                throw error
            }
        },
        [getClientForChain]
    )

    /**
     * Signs a USDC transfer UserOperation without broadcasting it.
     *
     * @param toAddress - Recipient address
     * @param amountInUsd - Amount in USD (will be converted to USDC token decimals)
     * @param chainId - Chain ID (defaults to Peanut wallet chain)
     * @returns Signed UserOperation data ready for backend submission
     *
     * @throws Error if signing fails (e.g., user cancels, invalid parameters)
     */
    const signTransferUserOp = useCallback(
        async (
            toAddress: Address,
            amountInUsd: string,
            chainId: string = PEANUT_WALLET_CHAIN.id.toString()
        ): Promise<SignedUserOpData> => {
            try {
                const amount = parseUnits(amountInUsd.replace(/,/g, ''), PEANUT_WALLET_TOKEN_DECIMALS)
                const txData = encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [toAddress, amount],
                }) as Hex

                return await signCallsUserOp(
                    [
                        {
                            to: PEANUT_WALLET_TOKEN as Hex,
                            value: 0n,
                            data: txData,
                        },
                    ],
                    chainId
                )
            } catch (error) {
                console.error('[useSignUserOp] Error signing UserOperation:', error)
                captureException(error, {
                    tags: { feature: 'sign-user-op' },
                    extra: {
                        toAddress,
                        amountInUsd,
                        chainId,
                    },
                })
                throw error
            }
        },
        [signCallsUserOp]
    )

    return { signTransferUserOp, signCallsUserOp, prepareCallsUserOp }
}

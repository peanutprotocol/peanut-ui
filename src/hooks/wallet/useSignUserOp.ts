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

export interface SignedUserOpData {
    signedUserOp: UnsignedUserOperation & { signature: Hex }
    chainId: string
    entryPointAddress: Address
}

/** Whether Pay signed the candidate prepared ahead of time or rebuilt the op. */
export type UserOpPreparationOrigin = 'reused' | 'fresh'

export interface SignCallsUserOpOptions {
    /** Candidate built before Pay by `useSmartSpendPreparation`. Signed only if
     *  it is still for this client, these calls and a live lock, its nonce
     *  still matches on-chain and a fresh sponsorship is obtained. Otherwise
     *  the op is rebuilt from scratch — same as with no candidate. */
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
 * malformed field is not "probably fine" — it is a reason to rebuild the op
 * through the full prepare, which validates the same response its own way.
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

/**
 * Sponsorship refresh for a reused candidate. The installed ZeroDev SDK returns
 * `paymasterData` as an opaque blob for EntryPoint 0.7 (no validUntil /
 * validAfter are exposed), so the client cannot prove an earlier sponsorship is
 * still valid — a TTL guess is not proof. Ask the paymaster again for the SAME
 * op instead; it re-estimates gas and re-signs. One RPC.
 */
async function refreshSponsorship(
    client: KernelClient,
    userOperation: UnsignedUserOperation,
    chainId: string
): Promise<SponsorshipRefresh | null> {
    const paymaster = client.paymaster
    if (!paymaster || paymaster === true || typeof paymaster.getPaymasterData !== 'function') return null
    // Same call viem's prepareUserOperation makes for the final sponsorship,
    // with the same request shape (stub signature included).
    const response = await paymaster.getPaymasterData({
        chainId: Number(chainId),
        entryPointAddress: USER_OP_ENTRY_POINT.address,
        context: client.paymasterContext,
        ...userOperation,
    } as Parameters<typeof paymaster.getPaymasterData>[0])
    return toSponsorshipRefresh(response)
}

/**
 * The harmless half of signing: encode the calls and let viem fill nonce,
 * factory args, gas and paymaster sponsorship. The bundler and paymaster do
 * receive the unsigned op for estimation and sponsorship, but nothing is
 * signed and nothing is broadcast — no passkey prompt, no state change.
 * Bound to ONE client: the account that prepared is the account that signs.
 */
async function prepareWithClient(
    client: KernelClient,
    calls: SmartSpendCall[],
    chainId: string
): Promise<Omit<PreparedSmartSpend, 'lockCode' | 'lockExpiresAtMs'>> {
    const account = client.account
    if (!account) {
        throw new Error('Smart account not initialized')
    }
    const callData = await account.encodeCalls(calls)
    const userOperation = (await client.prepareUserOperation({ account, callData })) as UnsignedUserOperation
    return {
        client,
        chainId,
        entryPointAddress: USER_OP_ENTRY_POINT.address,
        accountAddress: account.address,
        calls,
        userOperation,
    }
}

/**
 * Turns a pre-Pay candidate into a signable op, or returns null when it must
 * be rebuilt: wrong client/calls/lock, nonce moved on-chain, or no valid fresh
 * sponsorship. Every failure here is pre-signature and silent — the caller
 * falls back to the full prepare, which reports its own errors.
 */
async function reusePreparedUserOp(
    client: KernelClient,
    prepared: PreparedSmartSpend,
    calls: SmartSpendCall[],
    chainId: string
): Promise<UnsignedUserOperation | null> {
    if (preparedSmartSpendStaleness(prepared, { client, chainId, calls, now: Date.now() })) return null
    try {
        // Both are reads of current state; the sponsorship covers the
        // candidate's nonce, so it is only usable if the nonce re-read agrees.
        const [nonce, sponsorship] = await Promise.all([
            client.account!.getNonce(),
            refreshSponsorship(client, prepared.userOperation, chainId),
        ])
        if (nonce !== prepared.userOperation.nonce || !sponsorship) return null
        return {
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
        }
    } catch {
        return null
    }
}

/**
 * Hook to sign UserOperations without broadcasting them to the network.
 * This allows for a two-phase commit pattern where the transaction is signed first,
 * then submitted from the backend after confirming external dependencies (e.g., Manteca payment).
 */
export const useSignUserOp = () => {
    const { getClientForChain } = useKernelClient()

    /** Ahead-of-Pay preparation against the current client. See `prepareWithClient`. */
    const prepareCallsUserOp = useCallback(
        (calls: SmartSpendCall[], chainId: string = PEANUT_WALLET_CHAIN.id.toString()) =>
            prepareWithClient(getClientForChain(chainId), calls, chainId),
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
                let userOperation = options?.prepared
                    ? await reusePreparedUserOp(client, options.prepared, calls, chainId)
                    : null
                const origin: UserOpPreparationOrigin = userOperation ? 'reused' : 'fresh'
                if (!userOperation) userOperation = (await prepareWithClient(client, calls, chainId)).userOperation
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

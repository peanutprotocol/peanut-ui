import type { Address, Hex } from 'viem'
import { encodeFunctionData, erc20Abi } from 'viem'
import type { SignUserOperationReturnType } from '@zerodev/sdk/actions'
import { PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'

/**
 * The unsigned half of a smart-only spend, built ahead of Pay.
 *
 * Everything in here is a READ of chain/bundler/paymaster state: encoded
 * callData, factory args, nonce, gas limits and a paymaster sponsorship. No
 * signature, no broadcast, no provider draft. The candidate is bound to the
 * exact client, calls and payment lock it was built for; `preparedSmartSpendStaleness`
 * is the one place that decides whether Pay may still sign it.
 */

export interface SmartSpendCall {
    to: Hex
    value: bigint
    data: Hex
}

/**
 * The UserOp as viem prepares it (stub signature), flattened to the fields
 * the backend accepts — the same keys `completeQrPaymentWithSignedTx` picks.
 * Flat on purpose: viem's return type is a union over factory/paymaster
 * variants that a sponsorship refresh cannot be merged into.
 */
export type UnsignedUserOperation = Pick<
    SignUserOperationReturnType,
    | 'sender'
    | 'nonce'
    | 'callData'
    | 'signature'
    | 'callGasLimit'
    | 'verificationGasLimit'
    | 'preVerificationGas'
    | 'maxFeePerGas'
    | 'maxPriorityFeePerGas'
    | 'paymaster'
    | 'paymasterData'
    | 'paymasterVerificationGasLimit'
    | 'paymasterPostOpGasLimit'
    | 'factory'
    | 'factoryData'
>

export interface PreparedSmartSpend {
    /** The kernel client the op was prepared with. A rebuilt client (root-
     *  validator migration, re-login) is a different signer — never reuse. */
    client: object
    chainId: string
    entryPointAddress: Address
    accountAddress: Address
    calls: SmartSpendCall[]
    /** The payment lock this candidate pays. A different lock is a different payment. */
    lockCode: string
    /** Epoch ms after which the lock is dead and so is the candidate. */
    lockExpiresAtMs: number
    userOperation: UnsignedUserOperation
}

export type PreparedSmartSpendStaleness = 'client' | 'chain' | 'calls' | 'expired'

export function buildUsdcTransferCall(recipient: Address, amount: bigint): SmartSpendCall {
    return {
        to: PEANUT_WALLET_TOKEN as Hex,
        value: 0n,
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [recipient, amount] }),
    }
}

function sameCall(a: SmartSpendCall, b: SmartSpendCall): boolean {
    return (
        a.to.toLowerCase() === b.to.toLowerCase() &&
        a.value === b.value &&
        a.data.toLowerCase() === b.data.toLowerCase()
    )
}

/**
 * Why a candidate can no longer be signed as-is, or `null` when it still can.
 * Nonce and sponsorship freshness are NOT decided here — they need RPC reads,
 * which `useSignUserOp` does at Pay.
 */
export function preparedSmartSpendStaleness(
    prepared: PreparedSmartSpend,
    live: { client: object; chainId: string; calls: SmartSpendCall[]; now: number }
): PreparedSmartSpendStaleness | null {
    if (prepared.client !== live.client) return 'client'
    if (prepared.chainId !== live.chainId) return 'chain'
    if (
        prepared.calls.length !== live.calls.length ||
        !prepared.calls.every((call, i) => sameCall(call, live.calls[i]))
    )
        return 'calls'
    if (!(live.now < prepared.lockExpiresAtMs)) return 'expired'
    return null
}

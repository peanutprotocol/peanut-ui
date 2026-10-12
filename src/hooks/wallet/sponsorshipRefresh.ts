import { isAddress, isHex, type Address, type Hex } from 'viem'
import { arbitrum } from 'viem/chains'

export interface SponsorshipRefresh {
    paymaster: Address | undefined
    paymasterData: Hex | undefined
    paymasterVerificationGasLimit: bigint
    paymasterPostOpGasLimit: bigint
    callGasLimit: bigint
    verificationGasLimit: bigint
    preVerificationGas: bigint
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
}

const isGas = (value: unknown): value is bigint => typeof value === 'bigint' && value >= 0n

export function toSponsorshipRefresh(
    value: unknown,
    operation: { chainId: string; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }
): SponsorshipRefresh | null {
    if (!value || typeof value !== 'object') return null
    const v = value as Record<string, unknown>
    if (!isGas(v.callGasLimit) || !isGas(v.verificationGasLimit) || !isGas(v.preVerificationGas)) return null
    if (!isGas(v.paymasterVerificationGasLimit) || !isGas(v.paymasterPostOpGasLimit)) return null
    if (v.maxFeePerGas !== undefined && !isGas(v.maxFeePerGas)) return null
    if (v.maxPriorityFeePerGas !== undefined && !isGas(v.maxPriorityFeePerGas)) return null
    const gas = {
        callGasLimit: v.callGasLimit,
        verificationGasLimit: v.verificationGasLimit,
        preVerificationGas: v.preVerificationGas,
        ...(v.maxFeePerGas !== undefined ? { maxFeePerGas: v.maxFeePerGas as bigint } : {}),
        ...(v.maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas: v.maxPriorityFeePerGas as bigint } : {}),
    }
    if (v.paymaster === undefined && v.paymasterData === undefined) {
        // UltraRelay sponsors zero-fee Arbitrum ops without an on-chain paymaster.
        if (
            operation.chainId !== String(arbitrum.id) ||
            (v.maxFeePerGas ?? operation.maxFeePerGas) !== 0n ||
            (v.maxPriorityFeePerGas ?? operation.maxPriorityFeePerGas) !== 0n ||
            v.paymasterVerificationGasLimit !== 0n ||
            v.paymasterPostOpGasLimit !== 0n
        )
            return null
        return {
            ...gas,
            paymaster: undefined,
            paymasterData: undefined,
            paymasterVerificationGasLimit: 0n,
            paymasterPostOpGasLimit: 0n,
        }
    }
    if (typeof v.paymaster !== 'string' || !isAddress(v.paymaster, { strict: false })) return null
    if (typeof v.paymasterData !== 'string' || !isHex(v.paymasterData)) return null
    return {
        ...gas,
        paymaster: v.paymaster,
        paymasterData: v.paymasterData,
        paymasterVerificationGasLimit: v.paymasterVerificationGasLimit,
        paymasterPostOpGasLimit: v.paymasterPostOpGasLimit,
    }
}

export class InvalidSponsorshipResponseError extends Error {
    readonly responseShape: Record<string, string>

    constructor(value: unknown) {
        super('useSignUserOp: malformed sponsorship response after consuming the policy')
        this.name = 'InvalidSponsorshipResponseError'
        this.responseShape =
            value && typeof value === 'object'
                ? Object.fromEntries(Object.entries(value).map(([key, field]) => [key, typeof field]))
                : { response: typeof value }
    }
}

import { custom, type Transport } from 'viem'
import { jsonStringify } from './general.utils'
import Cookies from 'js-cookie'
import { PEANUT_API_URL } from '@/constants/general.consts'

export function createBackendRpcTransport(chainId: number): Transport {
    return custom({
        async request({ method, params }) {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            }

            const response = await fetch(`${PEANUT_API_URL}/rpc/proxy`, {
                method: 'POST',
                headers,
                body: jsonStringify({
                    chainId,
                    method,
                    params: params || [],
                    id: 1,
                }),
            })

            if (!response.ok) {
                throw new Error(`RPC proxy request failed: ${response.statusText}`)
            }

            const data = await response.json()

            if (data.error) {
                const error = new Error(data.error.message || 'RPC error') as any
                error.code = data.error.code
                throw error
            }

            return data.result
        },
    })
}

export function createBackendBundlerTransport(chainId: number): Transport {
    return custom({
        async request({ method, params }) {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            }

            const response = await fetch(`${PEANUT_API_URL}/rpc/bundler`, {
                method: 'POST',
                headers,
                body: jsonStringify({
                    chainId,
                    method,
                    params: params || [],
                    id: 1,
                }),
            })

            if (!response.ok) {
                throw new Error(`Bundler proxy request failed: ${response.statusText}`)
            }

            const data = await response.json()

            if (data.error) {
                const error = new Error(data.error.message || 'Bundler error') as any
                error.code = data.error.code
                throw error
            }

            return data.result
        },
    })
}

export async function requestPaymasterSponsorship(
    chainId: number,
    userOperation: any,
    entryPoint?: string,
    shouldOverrideFee?: boolean
) {
    const cleanUserOp: Record<string, any> = {
        sender: userOperation.sender,
        nonce: typeof userOperation.nonce === 'bigint' ? `0x${userOperation.nonce.toString(16)}` : userOperation.nonce,
        callData: userOperation.callData,
        signature: userOperation.signature,
        maxFeePerGas:
            typeof userOperation.maxFeePerGas === 'bigint'
                ? `0x${userOperation.maxFeePerGas.toString(16)}`
                : userOperation.maxFeePerGas,
        maxPriorityFeePerGas:
            typeof userOperation.maxPriorityFeePerGas === 'bigint'
                ? `0x${userOperation.maxPriorityFeePerGas.toString(16)}`
                : userOperation.maxPriorityFeePerGas,
    }

    if (userOperation.callGasLimit !== undefined) {
        cleanUserOp.callGasLimit =
            typeof userOperation.callGasLimit === 'bigint'
                ? `0x${userOperation.callGasLimit.toString(16)}`
                : userOperation.callGasLimit
    }
    if (userOperation.verificationGasLimit !== undefined) {
        cleanUserOp.verificationGasLimit =
            typeof userOperation.verificationGasLimit === 'bigint'
                ? `0x${userOperation.verificationGasLimit.toString(16)}`
                : userOperation.verificationGasLimit
    }
    if (userOperation.preVerificationGas !== undefined) {
        cleanUserOp.preVerificationGas =
            typeof userOperation.preVerificationGas === 'bigint'
                ? `0x${userOperation.preVerificationGas.toString(16)}`
                : userOperation.preVerificationGas
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Cookies.get('jwt-token')}`,
    }

    const response = await fetch(`${PEANUT_API_URL}/rpc/paymaster`, {
        method: 'POST',
        headers,
        body: jsonStringify({
            chainId,
            userOperation: cleanUserOp,
            entryPoint,
            shouldOverrideFee,
        }),
    })

    if (!response.ok) {
        throw new Error(`Paymaster proxy request failed: ${response.statusText}`)
    }

    return await response.json()
}

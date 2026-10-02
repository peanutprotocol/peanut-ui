/**
 * paymasterSponsorship — the one bridge between viem's per-request
 * `paymasterContext` and ZeroDev's `shouldConsume`.
 */
import { createClient, custom } from 'viem'
import { arbitrum } from 'viem/chains'
import { createBundlerClient, entryPoint07Address, type SmartAccount } from 'viem/account-abstraction'
import type { sponsorUserOperation } from '@zerodev/sdk'
import { PAYMASTER_PREVIEW_CONTEXT, isPaymasterPreviewContext, sponsorUserOperationArgs } from '../paymasterSponsorship'

// Bypass the suite's SDK mock so this tests the installed RPC serializer.
const { sponsorUserOperation: sdkSponsor } = jest.requireActual(
    '../../../../node_modules/@zerodev/sdk/_cjs/actions/paymaster/sponsorUserOperation.js'
) as { sponsorUserOperation: typeof sponsorUserOperation }

const op = (context?: unknown) => ({ sender: '0x1', nonce: 1n, context })

test('the preview marker is recognised by value, not by identity', () => {
    expect(isPaymasterPreviewContext(PAYMASTER_PREVIEW_CONTEXT)).toBe(true)
    expect(isPaymasterPreviewContext({ sponsorship: 'preview' })).toBe(true)
    expect(isPaymasterPreviewContext({ sponsorship: 'final' })).toBe(false)
    expect(isPaymasterPreviewContext(undefined)).toBe(false)
    expect(isPaymasterPreviewContext(null)).toBe(false)
    expect(isPaymasterPreviewContext('preview')).toBe(false)
})

test('a request consumes unless it carries the preview marker', () => {
    expect(sponsorUserOperationArgs(op()).shouldConsume).toBe(true)
    expect(sponsorUserOperationArgs(op({ other: true })).shouldConsume).toBe(true)
    expect(sponsorUserOperationArgs(op(PAYMASTER_PREVIEW_CONTEXT)).shouldConsume).toBe(false)
})

test('only paymasterContext is removed from a copy and the fee override is kept', () => {
    const userOperation = Object.freeze({
        ...op(PAYMASTER_PREVIEW_CONTEXT),
        paymasterContext: PAYMASTER_PREVIEW_CONTEXT,
    })
    const args = sponsorUserOperationArgs(userOperation)
    expect(args.userOperation).toEqual(op(PAYMASTER_PREVIEW_CONTEXT))
    expect(args.userOperation).not.toBe(userOperation)
    expect(userOperation.paymasterContext).toBe(PAYMASTER_PREVIEW_CONTEXT)
    expect(args.shouldOverrideFee).toBe(true)
    expect(Object.isFrozen(PAYMASTER_PREVIEW_CONTEXT)).toBe(true)
})

test('viem preparation through the installed SDK sends valid preview and consuming RPC payloads', async () => {
    const sender = '0x1111111111111111111111111111111111111111'
    const paymaster = '0x2222222222222222222222222222222222222222'
    const userOperation = Object.freeze({
        sender,
        nonce: 7n,
        callData: '0x1234' as const,
        callGasLimit: 100n,
        verificationGasLimit: 200n,
        preVerificationGas: 300n,
        maxFeePerGas: 400n,
        maxPriorityFeePerGas: 50n,
        signature: '0x5678' as const,
    })
    const request = jest.fn(async ({ method }: { method: string }) => {
        if (method !== 'zd_sponsorUserOperation') throw new Error(`unexpected RPC ${method}`)
        return {
            callGasLimit: '0x64',
            verificationGasLimit: '0xc8',
            preVerificationGas: '0x12c',
            paymaster,
            paymasterData: '0xabcd',
            paymasterVerificationGasLimit: '0xa',
            paymasterPostOpGasLimit: '0x14',
        }
    })
    const paymasterClient = createClient({ chain: arbitrum, transport: custom({ request }, { retryCount: 0 }) })
    const account = {
        address: sender,
        type: 'smart',
        entryPoint: { address: entryPoint07Address, version: '0.7' },
        getFactoryArgs: async () => ({}),
    }
    const client = createBundlerClient({
        account: account as SmartAccount,
        chain: arbitrum,
        transport: custom({
            request: async ({ method }) => {
                throw new Error(`unexpected bundler RPC ${method}`)
            },
        }),
        paymaster: {
            getPaymasterData: (parameters) =>
                sdkSponsor(paymasterClient as never, sponsorUserOperationArgs(parameters)),
        },
    })

    for (const context of [PAYMASTER_PREVIEW_CONTEXT, undefined]) {
        const parameters = Object.freeze({ ...userOperation, ...(context ? { paymasterContext: context } : {}) })
        const prepared = await client.prepareUserOperation(parameters)
        expect(prepared).toMatchObject({ ...userOperation, paymaster, paymasterData: '0xabcd' })
        expect(parameters).toEqual({ ...userOperation, ...(context ? { paymasterContext: context } : {}) })
    }

    // JSON normalization matches the wire payload and drops undefined SDK fields.
    const payloads = JSON.parse(JSON.stringify(request.mock.calls.map(([payload]) => payload)))
    expect(payloads).toEqual(
        [false, true].map((shouldConsume) => ({
            method: 'zd_sponsorUserOperation',
            params: [
                {
                    chainId: arbitrum.id,
                    entryPointAddress: entryPoint07Address,
                    shouldOverrideFee: true,
                    shouldConsume,
                    userOp: {
                        sender,
                        nonce: '0x7',
                        callData: '0x1234',
                        callGasLimit: '0x64',
                        verificationGasLimit: '0xc8',
                        preVerificationGas: '0x12c',
                        maxFeePerGas: '0x190',
                        maxPriorityFeePerGas: '0x32',
                        signature: '0x5678',
                    },
                },
            ],
        }))
    )
})

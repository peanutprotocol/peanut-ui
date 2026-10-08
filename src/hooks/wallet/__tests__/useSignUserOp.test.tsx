/**
 * useSignUserOp — prepare/sign split, pre-Pay candidate reuse, and
 * sponsorship consumption (TASK-22692).
 *
 * The client under test is a REAL viem bundler client whose transport throws
 * on any RPC, with a minimal smart account and the single `getPaymasterData`
 * callback wired exactly as kernelClient.context wires it: the real adapter
 * (`sponsorUserOperationArgs`) over a spy standing in for ZeroDev's
 * `sponsorUserOperation`. viem's own `prepareUserOperation` therefore decides
 * how often the paymaster is invoked and with which `context`; nothing here
 * hand-writes that count.
 *
 * Contracts:
 *  1. prepareCallsUserOp (warmup) never signs and never consumes — ONE
 *     paymaster invocation, shouldConsume:false, preview context forwarded,
 *  2. a usable candidate is signed after ONE nonce re-read and then ONE
 *     consuming sponsorship, with no viem preparation,
 *  3. every pre-consumption doubt — stale client/calls/lock, unsponsored
 *     client, nonce read failure, nonce moved — rebuilds the op through viem
 *     and only that rebuild consumes, once,
 *  4. a failure AFTER the consuming request (refusal, malformed answer) is
 *     never followed by another consuming request: it propagates,
 *  5. validation, fallback prepare and signature all run against the ONE
 *     client resolved at the start of the call; no client is mutated,
 *  6. a signing failure still propagates.
 */
import { act, renderHook } from '@testing-library/react'
import { custom, type Hex } from 'viem'
import { arbitrum } from 'viem/chains'
import { createBundlerClient } from 'viem/account-abstraction'

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
    USER_OP_ENTRY_POINT: { address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', version: '0.7' },
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/utils/webauthn.utils', () => ({ capturePasskeySignFailure: jest.fn() }))
const mockWithCeremonyPurpose = jest.fn((_purpose: string, fn: () => unknown) => fn())
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({
    withCeremonyPurpose: (purpose: string, fn: () => unknown) => mockWithCeremonyPurpose(purpose, fn),
}))

import { useSignUserOp } from '../useSignUserOp'
import { buildUsdcTransferCall, type PreparedSmartSpend } from '../smartSpendPreparation'
import { PAYMASTER_PREVIEW_CONTEXT, sponsorUserOperationArgs } from '../paymasterSponsorship'

const ACCOUNT = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'
const RECIPIENT = '0x4e5b89fd498f333ed7f2a59c5f23d5b5dc41b3de'
const PAYMASTER = '0x2a1c0c8d0c0f0c8d0c0f0c8d0c0f0c8d0c0f0c8d'
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

const NOW = 1_700_000_000_000
const CALLS = [buildUsdcTransferCall(RECIPIENT, 10_000_000n)]
/** A warmup result: what viem produced for the candidate (preview sponsorship). */
const PREPARED_OP = {
    sender: ACCOUNT,
    nonce: 7n,
    callData: CALLS[0].data,
    callGasLimit: 1n,
    verificationGasLimit: 1n,
    preVerificationGas: 1n,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
    paymaster: PAYMASTER,
    paymasterData: '0x0e0e',
    paymasterVerificationGasLimit: 1n,
    paymasterPostOpGasLimit: 1n,
    factory: undefined,
    factoryData: undefined,
    signature: '0x57',
}
// Full gas in the answer, as ZeroDev returns it: viem then needs no bundler
// estimation, so the throwing transport proves no RPC left the client.
const sponsorship = (paymasterData: Hex) => ({
    paymaster: PAYMASTER,
    paymasterData,
    callGasLimit: 2n,
    verificationGasLimit: 2n,
    preVerificationGas: 2n,
    paymasterVerificationGasLimit: 2n,
    paymasterPostOpGasLimit: 2n,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
})

type SponsorArgs = ReturnType<typeof sponsorUserOperationArgs>

function makeAccount(label: string) {
    return {
        address: ACCOUNT,
        type: 'smart' as const,
        client: {},
        entryPoint: { address: ENTRY_POINT, version: '0.7' as const, abi: [] },
        getFactoryArgs: jest.fn(async () => ({ factory: undefined, factoryData: undefined })),
        getNonce: jest.fn(async () => 7n),
        getStubSignature: jest.fn(async () => '0x57'),
        encodeCalls: jest.fn(async (calls: { data: string }[]) => calls[0].data),
        signUserOperation: jest.fn(async () => `0x5${label}`),
        getAddress: jest.fn(async () => ACCOUNT),
        isDeployed: jest.fn(async () => true),
        decodeCalls: jest.fn(),
        signMessage: jest.fn(),
        signTypedData: jest.fn(),
    }
}

function makeClient(label: string, options: { sponsored?: boolean } = {}) {
    const { sponsored = true } = options
    const account = makeAccount(label)
    const sponsor = jest.fn(async (args: SponsorArgs) => sponsorship(args.shouldConsume ? '0xf00d' : '0x0e0e'))
    const client = createBundlerClient({
        account: sponsored
            ? (account as never)
            : // unsponsored: gas comes from the account, never from a bundler RPC
              ({
                  ...account,
                  userOperation: {
                      estimateGas: async () => ({ callGasLimit: 1n, verificationGasLimit: 1n, preVerificationGas: 1n }),
                  },
              } as never),
        chain: arbitrum,
        transport: custom({
            request: async ({ method }: { method: string }) => {
                throw new Error(`unexpected RPC ${method}`)
            },
        }),
        ...(sponsored
            ? {
                  // the REAL adapter, as kernelClient.context wires it — one callback only
                  paymaster: {
                      getPaymasterData: (params: unknown) =>
                          sponsor(sponsorUserOperationArgs(params as { context?: unknown })) as never,
                  },
              }
            : {}),
        userOperation: { estimateFeesPerGas: async () => ({ maxFeePerGas: 0n, maxPriorityFeePerGas: 0n }) },
    })
    return { client, account: client.account as unknown as ReturnType<typeof makeAccount>, sponsor }
}
type Fake = ReturnType<typeof makeClient>

let fake: Fake
const mockGetClientForChain = jest.fn(() => fake.client)
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({ getClientForChain: () => mockGetClientForChain() }),
}))

const consumptions = (f: Fake) => f.sponsor.mock.calls.map(([args]) => args.shouldConsume)

function candidate(overrides: Partial<PreparedSmartSpend> = {}): PreparedSmartSpend {
    return {
        client: fake.client,
        chainId: '42161',
        entryPointAddress: ENTRY_POINT,
        accountAddress: ACCOUNT,
        calls: CALLS,
        lockCode: 'LOCK123',
        lockExpiresAtMs: NOW + 60_000,
        userOperation: PREPARED_OP as unknown as PreparedSmartSpend['userOperation'],
        ...overrides,
    }
}

beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Date, 'now').mockReturnValue(NOW)
    fake = makeClient('a')
    mockGetClientForChain.mockImplementation(() => fake.client)
})

afterEach(() => {
    jest.restoreAllMocks()
})

async function signWith(prepared: PreparedSmartSpend | undefined, calls = CALLS) {
    const onPrepared = jest.fn()
    const { result } = renderHook(() => useSignUserOp())
    let signed: Awaited<ReturnType<typeof result.current.signCallsUserOp>> | undefined
    await act(async () => {
        signed = await result.current.signCallsUserOp(calls, '42161', { prepared, onPrepared })
    })
    return { signed, onPrepared }
}

/** Rebuilt through viem on `f`: its single paymaster call is the ONLY consumption, one signature. */
function expectRebuiltOn(
    f: Fake,
    signed: { signedUserOp: { nonce: bigint; paymasterData?: string } } | undefined,
    onPrepared: jest.Mock,
    nonce = 7n
) {
    // viem's preparation ran (stub signature is only ever asked for there)
    expect(f.account.getStubSignature).toHaveBeenCalledTimes(1)
    expect(onPrepared).toHaveBeenCalledWith('fresh')
    expect(f.account.signUserOperation).toHaveBeenCalledTimes(1)
    expect(signed?.signedUserOp.nonce).toBe(nonce)
    expect(signed?.signedUserOp.paymasterData).toBe('0xf00d')
    expect(consumptions(f)).toEqual([true])
    expect(f.sponsor.mock.calls[0][0].userOperation.context).toBeUndefined()
}

describe('prepareCallsUserOp (warmup) through viem', () => {
    it('previews: ONE paymaster invocation with the preview context, shouldConsume:false, no signature, no RPC, no client change', async () => {
        const paymasterBefore = fake.client.paymaster
        const { result } = renderHook(() => useSignUserOp())
        let prepared: Awaited<ReturnType<typeof result.current.prepareCallsUserOp>> | undefined
        await act(async () => {
            prepared = await result.current.prepareCallsUserOp(CALLS)
        })

        expect(fake.account.encodeCalls).toHaveBeenCalledWith(CALLS)
        expect(fake.account.getNonce).toHaveBeenCalledTimes(1)
        expect(fake.sponsor).toHaveBeenCalledTimes(1)
        expect(consumptions(fake)).toEqual([false])
        const [args] = fake.sponsor.mock.calls[0]
        expect(args.userOperation.context).toBe(PAYMASTER_PREVIEW_CONTEXT)
        expect(args.userOperation).toMatchObject({ sender: ACCOUNT, nonce: 7n, callData: CALLS[0].data })
        expect(prepared).toMatchObject({ client: fake.client, chainId: '42161', accountAddress: ACCOUNT, calls: CALLS })
        expect(prepared?.userOperation).toMatchObject({ nonce: 7n, callData: CALLS[0].data, paymasterData: '0x0e0e' })
        expect(fake.account.signUserOperation).not.toHaveBeenCalled()
        expect(mockWithCeremonyPurpose).not.toHaveBeenCalled()
        // an abandoned warmup leaves the shared client exactly as it was
        expect(fake.client.paymaster).toBe(paymasterBefore)
        expect(fake.client.paymasterContext).toBeUndefined()
    })

    it('warmup then Pay on the same client: preview, then exactly one consumption, one signature', async () => {
        const { result } = renderHook(() => useSignUserOp())
        let prepared: Awaited<ReturnType<typeof result.current.prepareCallsUserOp>> | undefined
        await act(async () => {
            prepared = await result.current.prepareCallsUserOp(CALLS)
        })
        let signed: Awaited<ReturnType<typeof result.current.signCallsUserOp>> | undefined
        await act(async () => {
            signed = await result.current.signCallsUserOp(CALLS, '42161', {
                prepared: { ...prepared!, lockCode: 'LOCK123', lockExpiresAtMs: NOW + 60_000 },
            })
        })
        expect(consumptions(fake)).toEqual([false, true])
        expect(fake.account.getStubSignature).toHaveBeenCalledTimes(1) // the warmup's viem preparation only
        expect(fake.account.signUserOperation).toHaveBeenCalledTimes(1)
        expect(signed?.signedUserOp).toMatchObject({ nonce: 7n, paymasterData: '0xf00d', signature: '0x5a' })
    })
})

describe('signCallsUserOp with a pre-Pay candidate', () => {
    it('re-reads the nonce FIRST, then consumes one sponsorship for the candidate, then signs — no viem preparation', async () => {
        const { signed, onPrepared } = await signWith(candidate())

        expect(fake.account.getNonce).toHaveBeenCalledTimes(1)
        expect(fake.sponsor).toHaveBeenCalledTimes(1)
        expect(fake.account.getNonce.mock.invocationCallOrder[0]).toBeLessThan(fake.sponsor.mock.invocationCallOrder[0])
        expect(consumptions(fake)).toEqual([true])
        const [args] = fake.sponsor.mock.calls[0]
        expect(args.userOperation).toMatchObject({
            chainId: 42161,
            entryPointAddress: ENTRY_POINT,
            context: undefined,
            sender: ACCOUNT,
            nonce: 7n,
            callData: CALLS[0].data,
        })
        expect(fake.account.getStubSignature).not.toHaveBeenCalled()
        expect(fake.account.encodeCalls).not.toHaveBeenCalled()
        expect(onPrepared).toHaveBeenCalledWith('reused')
        expect(mockWithCeremonyPurpose).toHaveBeenCalledTimes(1)
        expect(mockWithCeremonyPurpose.mock.calls[0][0]).toBe('user_op')
        expect(fake.account.signUserOperation).toHaveBeenCalledTimes(1)
        // the consumed sponsorship (and its gas) replaces the preview one; the
        // candidate's nonce and callData are what gets signed
        expect(fake.account.signUserOperation).toHaveBeenCalledWith(
            expect.objectContaining({ nonce: 7n, callData: CALLS[0].data, paymasterData: '0xf00d', callGasLimit: 2n })
        )
        expect(signed).toEqual({
            signedUserOp: expect.objectContaining({ nonce: 7n, paymasterData: '0xf00d', signature: '0x5a' }),
            chainId: '42161',
            entryPointAddress: ENTRY_POINT,
        })
        expect(fake.client.paymasterContext).toBeUndefined()
    })

    it('nonce moved on-chain: nothing consumed for the candidate; the viem rebuild consumes once', async () => {
        fake.account.getNonce.mockResolvedValue(9n)
        const { signed, onPrepared } = await signWith(candidate())
        // once by the candidate check, once by viem's preparation
        expect(fake.account.getNonce).toHaveBeenCalledTimes(2)
        expectRebuiltOn(fake, signed, onPrepared, 9n)
    })

    it('nonce read fails: treated as stale, nothing consumed for the candidate', async () => {
        fake.account.getNonce.mockRejectedValueOnce(new Error('rpc down'))
        const { signed, onPrepared } = await signWith(candidate())
        expectRebuiltOn(fake, signed, onPrepared)
    })

    it('no paymaster (unsponsored client): rebuilds through viem without any sponsorship', async () => {
        fake = makeClient('a', { sponsored: false })
        const { signed, onPrepared } = await signWith(candidate())
        expect(fake.account.getStubSignature).toHaveBeenCalledTimes(1)
        expect(onPrepared).toHaveBeenCalledWith('fresh')
        expect(fake.account.signUserOperation).toHaveBeenCalledTimes(1)
        expect(signed?.signedUserOp.nonce).toBe(7n)
        expect(fake.sponsor).not.toHaveBeenCalled()
    })

    it('expired lock: rebuilds without a candidate nonce read or sponsorship', async () => {
        const { signed, onPrepared } = await signWith(candidate({ lockExpiresAtMs: NOW }))
        expect(fake.account.getNonce).toHaveBeenCalledTimes(1) // viem's, not the candidate check
        expectRebuiltOn(fake, signed, onPrepared)
    })

    it('different calls than the candidate (amount changed): rebuilds', async () => {
        const { signed, onPrepared } = await signWith(candidate(), [buildUsdcTransferCall(RECIPIENT, 1n)])
        expect(fake.account.getNonce).toHaveBeenCalledTimes(1)
        expectRebuiltOn(fake, signed, onPrepared)
    })

    it('no candidate at all: the original single-preparation path, consuming once', async () => {
        const { signed, onPrepared } = await signWith(undefined)
        expect(fake.account.getNonce).toHaveBeenCalledTimes(1)
        expectRebuiltOn(fake, signed, onPrepared)
    })

    it('the paymaster refuses the consuming request: propagates, no second consuming request, nothing signed', async () => {
        fake.sponsor.mockRejectedValueOnce(new Error('policy exhausted'))
        const { result } = renderHook(() => useSignUserOp())
        await act(async () => {
            await expect(result.current.signCallsUserOp(CALLS, '42161', { prepared: candidate() })).rejects.toThrow(
                'policy exhausted'
            )
        })
        expect(consumptions(fake)).toEqual([true])
        expect(fake.account.getStubSignature).not.toHaveBeenCalled()
        expect(fake.account.signUserOperation).not.toHaveBeenCalled()
    })

    it.each([
        ['no paymaster address', { ...sponsorship('0xf00d'), paymaster: undefined }],
        ['paymasterData that is not hex', { ...sponsorship('0xf00d'), paymasterData: 'not-hex' }],
        ['a gas limit as a number', { ...sponsorship('0xf00d'), callGasLimit: 2 }],
        ['a missing gas limit', { ...sponsorship('0xf00d'), preVerificationGas: undefined }],
        ['a fee that is not a bigint', { ...sponsorship('0xf00d'), maxFeePerGas: '0' }],
        ['a non-object', 'sponsored'],
    ])(
        'a malformed answer to the consuming request (%s): propagates, never merged, never re-consumed',
        async (_label, response) => {
            fake.sponsor.mockResolvedValueOnce(response as never)
            const { result } = renderHook(() => useSignUserOp())
            await act(async () => {
                await expect(result.current.signCallsUserOp(CALLS, '42161', { prepared: candidate() })).rejects.toThrow(
                    'malformed sponsorship'
                )
            })
            expect(consumptions(fake)).toEqual([true])
            expect(fake.account.getStubSignature).not.toHaveBeenCalled()
            expect(fake.account.signUserOperation).not.toHaveBeenCalled()
        }
    )

    it('a passkey failure on a reused candidate still throws, after exactly one consumption', async () => {
        fake.account.signUserOperation.mockRejectedValue(new Error('User action is not allowed'))
        const { result } = renderHook(() => useSignUserOp())
        await act(async () => {
            await expect(result.current.signCallsUserOp(CALLS, '42161', { prepared: candidate() })).rejects.toThrow(
                'not allowed'
            )
        })
        expect(consumptions(fake)).toEqual([true])
        expect(fake.account.getStubSignature).not.toHaveBeenCalled()
    })
})

describe('signCallsUserOp binds validation, fallback prepare and signature to one client', () => {
    it('kernel client rebuilt between candidate validation and the fallback: prepares AND signs on the client captured at call start', async () => {
        const a = fake
        const b = makeClient('b')
        // the candidate belongs to A, its nonce has moved; while the nonce
        // re-read is in flight the provider swaps the cached client for B
        a.account.getNonce.mockImplementation(async () => {
            mockGetClientForChain.mockImplementation(() => b.client)
            return 9n
        })
        const { signed, onPrepared } = await signWith(candidate({ client: a.client }))

        expectRebuiltOn(a, signed, onPrepared, 9n)
        expect(b.account.getStubSignature).not.toHaveBeenCalled()
        expect(b.account.signUserOperation).not.toHaveBeenCalled()
        expect(b.sponsor).not.toHaveBeenCalled()
        expect(signed?.signedUserOp.signature).toBe('0x5a')
    })

    it('kernel client rebuilt BEFORE Pay: the candidate from the old client is dropped and the new client prepares and signs', async () => {
        const a = fake
        const b = makeClient('b')
        mockGetClientForChain.mockImplementation(() => b.client)
        const { signed, onPrepared } = await signWith(candidate({ client: a.client }))

        expectRebuiltOn(b, signed, onPrepared)
        expect(a.account.getNonce).not.toHaveBeenCalled()
        expect(a.account.getStubSignature).not.toHaveBeenCalled()
        expect(a.account.signUserOperation).not.toHaveBeenCalled()
        expect(a.sponsor).not.toHaveBeenCalled()
        expect(signed?.signedUserOp.signature).toBe('0x5b')
    })
})

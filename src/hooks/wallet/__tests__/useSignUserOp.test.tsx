/**
 * useSignUserOp — prepare/sign split and the pre-Pay candidate reuse.
 *
 * Contracts:
 *  1. prepareCallsUserOp never signs,
 *  2. a usable candidate is signed after ONE nonce re-read and ONE fresh,
 *     shape-validated sponsorship (paymasterData is opaque to the client, so
 *     it is never trusted across time), with no second prepareUserOperation,
 *  3. every pre-signature doubt — nonce moved, no paymaster to ask, the
 *     paymaster refusing or answering malformed, a stale client/calls/lock —
 *     rebuilds the op from scratch, silently, and signs exactly once,
 *  4. validation, fallback prepare and signature all run against the ONE
 *     client resolved at the start of the call, even if the kernel client is
 *     rebuilt while the call is in flight,
 *  5. a signing failure still propagates.
 */
import { act, renderHook } from '@testing-library/react'

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

const ACCOUNT = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'
const RECIPIENT = '0x4e5b89fd498f333ed7f2a59c5f23d5b5dc41b3de'
const PAYMASTER = '0x2a1c0c8d0c0f0c8d0c0f0c8d0c0f0c8d0c0f0c8d'

type FakeClient = {
    account: {
        address: string
        encodeCalls: jest.Mock
        getNonce: jest.Mock
        signUserOperation: jest.Mock
    }
    prepareUserOperation: jest.Mock
    paymaster: unknown
    paymasterContext: unknown
}
function makeClient(label: string, nonce = 8n): FakeClient {
    return {
        account: {
            address: ACCOUNT,
            encodeCalls: jest.fn(async (calls: { data: string }[]) => calls[0].data),
            getNonce: jest.fn(async () => 7n),
            signUserOperation: jest.fn(async () => `0x5${label}`),
        },
        prepareUserOperation: jest.fn(async ({ callData }: { callData: string }) => ({
            ...PREPARED_OP,
            nonce,
            callData,
        })),
        paymaster: { getPaymasterData: jest.fn(async () => FRESH_SPONSORSHIP) },
        paymasterContext: undefined,
    }
}
let fakeClient: FakeClient
const mockGetClientForChain = jest.fn(() => fakeClient)
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({ getClientForChain: () => mockGetClientForChain() }),
}))

import { useSignUserOp } from '../useSignUserOp'
import { buildUsdcTransferCall, type PreparedSmartSpend } from '../smartSpendPreparation'

const NOW = 1_700_000_000_000
const CALLS = [buildUsdcTransferCall(RECIPIENT, 10_000_000n)]
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
    paymasterData: '0x01d0',
    paymasterVerificationGasLimit: 1n,
    paymasterPostOpGasLimit: 1n,
    factory: undefined,
    factoryData: undefined,
    signature: '0x57',
}
const FRESH_SPONSORSHIP = {
    paymaster: PAYMASTER,
    paymasterData: '0xf00d',
    callGasLimit: 2n,
    verificationGasLimit: 2n,
    preVerificationGas: 2n,
    paymasterVerificationGasLimit: 2n,
    paymasterPostOpGasLimit: 2n,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
}

function candidate(overrides: Partial<PreparedSmartSpend> = {}): PreparedSmartSpend {
    return {
        client: fakeClient,
        chainId: '42161',
        entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
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
    fakeClient = makeClient('a')
    mockGetClientForChain.mockImplementation(() => fakeClient)
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

function expectRebuiltOn(
    client: FakeClient,
    signed: { signedUserOp: { nonce: bigint } } | undefined,
    onPrepared: jest.Mock
) {
    expect(client.prepareUserOperation).toHaveBeenCalledTimes(1)
    expect(onPrepared).toHaveBeenCalledWith('fresh')
    expect(client.account.signUserOperation).toHaveBeenCalledTimes(1)
    expect(signed?.signedUserOp.nonce).toBe(8n)
}

describe('prepareCallsUserOp', () => {
    it('encodes and prepares without any signature ceremony', async () => {
        const { result } = renderHook(() => useSignUserOp())
        let prepared: Awaited<ReturnType<typeof result.current.prepareCallsUserOp>> | undefined
        await act(async () => {
            prepared = await result.current.prepareCallsUserOp(CALLS)
        })
        expect(fakeClient.account.encodeCalls).toHaveBeenCalledWith(CALLS)
        expect(fakeClient.prepareUserOperation).toHaveBeenCalledWith({
            account: fakeClient.account,
            callData: CALLS[0].data,
        })
        expect(prepared).toMatchObject({ client: fakeClient, chainId: '42161', accountAddress: ACCOUNT, calls: CALLS })
        expect(fakeClient.account.signUserOperation).not.toHaveBeenCalled()
        expect(mockWithCeremonyPurpose).not.toHaveBeenCalled()
    })
})

describe('signCallsUserOp with a pre-Pay candidate', () => {
    it('re-reads the nonce, refreshes the sponsorship and signs the candidate — no second prepare', async () => {
        const { signed, onPrepared } = await signWith(candidate())
        expect(fakeClient.account.getNonce).toHaveBeenCalledTimes(1)
        const getPaymasterData = (fakeClient.paymaster as { getPaymasterData: jest.Mock }).getPaymasterData
        expect(getPaymasterData).toHaveBeenCalledTimes(1)
        expect(getPaymasterData).toHaveBeenCalledWith(
            expect.objectContaining({
                chainId: 42161,
                entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
                sender: ACCOUNT,
                nonce: 7n,
                callData: CALLS[0].data,
            })
        )
        expect(fakeClient.prepareUserOperation).not.toHaveBeenCalled()
        expect(fakeClient.account.encodeCalls).not.toHaveBeenCalled()
        expect(onPrepared).toHaveBeenCalledWith('reused')
        expect(mockWithCeremonyPurpose).toHaveBeenCalledTimes(1)
        expect(mockWithCeremonyPurpose.mock.calls[0][0]).toBe('user_op')
        expect(fakeClient.account.signUserOperation).toHaveBeenCalledTimes(1)
        // the fresh sponsorship (and its gas) replaces the stale one; the
        // candidate's nonce and callData are what gets signed
        expect(fakeClient.account.signUserOperation).toHaveBeenCalledWith(
            expect.objectContaining({ nonce: 7n, callData: CALLS[0].data, paymasterData: '0xf00d', callGasLimit: 2n })
        )
        expect(signed).toEqual({
            signedUserOp: expect.objectContaining({ nonce: 7n, paymasterData: '0xf00d', signature: '0x5a' }),
            chainId: '42161',
            entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        })
    })

    it('nonce moved on-chain: rebuilds and signs once', async () => {
        fakeClient.account.getNonce.mockResolvedValue(9n)
        const { signed, onPrepared } = await signWith(candidate())
        expectRebuiltOn(fakeClient, signed, onPrepared)
    })

    it('no paymaster to refresh with (unsponsored client): rebuilds', async () => {
        fakeClient.paymaster = undefined
        const { signed, onPrepared } = await signWith(candidate())
        expectRebuiltOn(fakeClient, signed, onPrepared)
    })

    it('paymaster refuses the refresh: rebuilds instead of signing a stale sponsorship', async () => {
        ;(fakeClient.paymaster as { getPaymasterData: jest.Mock }).getPaymasterData.mockRejectedValue(
            new Error('policy exhausted')
        )
        const { signed, onPrepared } = await signWith(candidate())
        expectRebuiltOn(fakeClient, signed, onPrepared)
    })

    it.each([
        ['no paymaster address', { ...FRESH_SPONSORSHIP, paymaster: undefined }],
        ['paymasterData that is not hex', { ...FRESH_SPONSORSHIP, paymasterData: 'not-hex' }],
        ['a gas limit as a number', { ...FRESH_SPONSORSHIP, callGasLimit: 2 }],
        ['a missing gas limit', { ...FRESH_SPONSORSHIP, preVerificationGas: undefined }],
        ['a fee that is not a bigint', { ...FRESH_SPONSORSHIP, maxFeePerGas: '0' }],
        ['a non-object', 'sponsored'],
    ])('malformed sponsorship (%s) is never merged into the op: rebuilds', async (_label, response) => {
        ;(fakeClient.paymaster as { getPaymasterData: jest.Mock }).getPaymasterData.mockResolvedValue(response)
        const { signed, onPrepared } = await signWith(candidate())
        expectRebuiltOn(fakeClient, signed, onPrepared)
        expect(fakeClient.account.signUserOperation).not.toHaveBeenCalledWith(
            expect.objectContaining({ paymasterData: 'not-hex' })
        )
    })

    it('expired lock: rebuilds without touching the chain for the candidate', async () => {
        const { signed, onPrepared } = await signWith(candidate({ lockExpiresAtMs: NOW }))
        expect(fakeClient.account.getNonce).not.toHaveBeenCalled()
        expect((fakeClient.paymaster as { getPaymasterData: jest.Mock }).getPaymasterData).not.toHaveBeenCalled()
        expectRebuiltOn(fakeClient, signed, onPrepared)
    })

    it('different calls than the candidate (amount changed): rebuilds', async () => {
        const { signed, onPrepared } = await signWith(candidate(), [buildUsdcTransferCall(RECIPIENT, 1n)])
        expectRebuiltOn(fakeClient, signed, onPrepared)
    })

    it('no candidate at all: the original single-prepare path', async () => {
        const { signed, onPrepared } = await signWith(undefined)
        expect(fakeClient.account.getNonce).not.toHaveBeenCalled()
        expectRebuiltOn(fakeClient, signed, onPrepared)
    })

    it('a passkey failure on a reused candidate still throws', async () => {
        fakeClient.account.signUserOperation.mockRejectedValue(new Error('User action is not allowed'))
        const { result } = renderHook(() => useSignUserOp())
        await act(async () => {
            await expect(result.current.signCallsUserOp(CALLS, '42161', { prepared: candidate() })).rejects.toThrow(
                'not allowed'
            )
        })
        expect(fakeClient.prepareUserOperation).not.toHaveBeenCalled()
    })
})

describe('signCallsUserOp binds validation, fallback prepare and signature to one client', () => {
    it('kernel client rebuilt between candidate validation and the fallback: prepares AND signs on the client captured at call start', async () => {
        const clientA = fakeClient
        const clientB = makeClient('b')
        // the candidate belongs to A, its nonce has moved; while the nonce
        // re-read is in flight the provider swaps the cached client for B
        clientA.account.getNonce.mockImplementation(async () => {
            mockGetClientForChain.mockImplementation(() => clientB)
            return 9n
        })
        const { signed, onPrepared } = await signWith(candidate({ client: clientA }))

        expectRebuiltOn(clientA, signed, onPrepared)
        expect(clientB.prepareUserOperation).not.toHaveBeenCalled()
        expect(clientB.account.signUserOperation).not.toHaveBeenCalled()
        expect(signed?.signedUserOp.signature).toBe('0x5a')
    })

    it('kernel client rebuilt BEFORE Pay: the candidate from the old client is dropped and the new client prepares and signs', async () => {
        const clientA = fakeClient
        const clientB = makeClient('b')
        mockGetClientForChain.mockImplementation(() => clientB)
        const { signed, onPrepared } = await signWith(candidate({ client: clientA }))

        expectRebuiltOn(clientB, signed, onPrepared)
        expect(clientA.account.getNonce).not.toHaveBeenCalled()
        expect(clientA.prepareUserOperation).not.toHaveBeenCalled()
        expect(clientA.account.signUserOperation).not.toHaveBeenCalled()
        expect(signed?.signedUserOp.signature).toBe('0x5b')
    })
})

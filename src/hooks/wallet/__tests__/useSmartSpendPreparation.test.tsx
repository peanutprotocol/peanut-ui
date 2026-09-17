/**
 * useSmartSpendPreparation — the pre-Pay candidate lifecycle.
 *
 * Contracts:
 *  1. preparation is reads only: encodeCalls + prepareUserOperation, never a
 *     signature,
 *  2. one candidate per identity: StrictMode replays and same-key re-renders
 *     coalesce onto the in-flight preparation,
 *  3. any identity change (amount, recipient, account, lock, expiry) rebuilds
 *     and a result from the superseded preparation is discarded,
 *  4. disabled / expired / unknown-expiry inputs prepare nothing,
 *  5. a failed preparation is silent — take() yields null,
 *  6. take() is one-shot.
 */
import React from 'react'
import { act, renderHook } from '@testing-library/react'

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
    USER_OP_ENTRY_POINT: { address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', version: '0.7' },
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/utils/webauthn.utils', () => ({ capturePasskeySignFailure: jest.fn() }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({
    withCeremonyPurpose: (_purpose: string, fn: () => unknown) => fn(),
}))

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void }
function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

const ACCOUNT = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'
const RECIPIENT = '0x4e5b89fd498f333ed7f2a59c5f23d5b5dc41b3de'

const mockSignUserOperation = jest.fn()
const mockEncodeCalls = jest.fn(async (calls: { data: string }[]) => calls[0].data)
const mockPrepareUserOperation = jest.fn()
const fakeClient = {
    account: { address: ACCOUNT, encodeCalls: mockEncodeCalls, signUserOperation: mockSignUserOperation },
    prepareUserOperation: mockPrepareUserOperation,
}
const mockEnsureClientForChain = jest.fn(async () => fakeClient)
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        getClientForChain: () => fakeClient,
        ensureClientForChain: mockEnsureClientForChain,
    }),
}))

import { useSmartSpendPreparation, type SmartSpendPreparationInput } from '../useSmartSpendPreparation'

const NOW = Date.parse('2026-09-16T12:00:00Z')
const baseInput = (): SmartSpendPreparationInput => ({
    enabled: true,
    accountAddress: ACCOUNT,
    requiredUsdcAmount: 10_000_000n,
    recipient: RECIPIENT,
    lockCode: 'LOCK123',
    lockExpiresAt: new Date(NOW + 120_000).toISOString(),
})

beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Date, 'now').mockReturnValue(NOW)
    mockPrepareUserOperation.mockImplementation(async ({ callData }: { callData: string }) => ({
        sender: ACCOUNT,
        nonce: 7n,
        callData,
        signature: '0xstub',
    }))
})

afterEach(() => {
    jest.restoreAllMocks()
})

const flush = () => act(async () => {})

test('mount prepares exactly once and never signs', async () => {
    const { result } = renderHook((input: SmartSpendPreparationInput) => useSmartSpendPreparation(input), {
        initialProps: baseInput(),
    })
    await flush()

    expect(mockEnsureClientForChain).toHaveBeenCalledWith('42161')
    expect(mockPrepareUserOperation).toHaveBeenCalledTimes(1)
    // a warmup is a PREVIEW: the request carries the marker that stops the
    // ZeroDev callback from consuming the sponsorship policy
    expect(mockPrepareUserOperation).toHaveBeenCalledWith(
        expect.objectContaining({ paymasterContext: { sponsorship: 'preview' } })
    )
    expect(mockSignUserOperation).not.toHaveBeenCalled()

    const candidate = result.current.takePreparedSmartSpend()
    expect(candidate).toMatchObject({
        client: fakeClient,
        chainId: '42161',
        accountAddress: ACCOUNT,
        lockCode: 'LOCK123',
        lockExpiresAtMs: NOW + 120_000,
        userOperation: { nonce: 7n },
    })
    expect(candidate!.calls[0].to).toBe('0xaf88d065e77c8cC2239327C5EDb3A432268e5831')
    // one-shot: the nonce may be spent after Pay, whatever Pay did with it
    expect(result.current.takePreparedSmartSpend()).toBeNull()
})

test('StrictMode replay and same-identity re-renders coalesce onto one preparation', async () => {
    const { result, rerender } = renderHook((input: SmartSpendPreparationInput) => useSmartSpendPreparation(input), {
        initialProps: baseInput(),
        wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode>,
    })
    // a fresh object with the same values must not count as a new identity
    rerender(baseInput())
    rerender({ ...baseInput(), recipient: RECIPIENT.toUpperCase().replace('0X', '0x') as typeof RECIPIENT })
    await flush()

    expect(mockPrepareUserOperation).toHaveBeenCalledTimes(1)
    expect(result.current.takePreparedSmartSpend()).not.toBeNull()
})

test.each<[string, Partial<SmartSpendPreparationInput>]>([
    ['amount', { requiredUsdcAmount: 10_000_001n }],
    ['recipient', { recipient: '0x1111111111111111111111111111111111111111' }],
    ['account', { accountAddress: '0x2222222222222222222222222222222222222222' }],
    ['lock code', { lockCode: 'LOCK456' }],
    ['lock expiry', { lockExpiresAt: new Date(NOW + 300_000).toISOString() }],
])('a changed %s rebuilds the candidate and discards the superseded result', async (_label, change) => {
    const first = deferred<object>()
    mockPrepareUserOperation.mockReturnValueOnce(first.promise)
    const { result, rerender } = renderHook((input: SmartSpendPreparationInput) => useSmartSpendPreparation(input), {
        initialProps: baseInput(),
    })
    await flush()
    expect(mockPrepareUserOperation).toHaveBeenCalledTimes(1)

    rerender({ ...baseInput(), ...change })
    await flush()
    expect(mockPrepareUserOperation).toHaveBeenCalledTimes(2)

    // the FIRST preparation settles late — it must not become the candidate
    await act(async () => {
        first.resolve({ sender: ACCOUNT, nonce: 1n, callData: '0xstale', signature: '0xstub' })
    })
    const candidate = result.current.takePreparedSmartSpend()
    expect(candidate?.userOperation.nonce).toBe(7n)
    expect(candidate?.userOperation.callData).not.toBe('0xstale')
})

test('a result that lands after unmount is dropped, not kept for a later instance', async () => {
    const pending = deferred<object>()
    mockPrepareUserOperation.mockReturnValueOnce(pending.promise)
    const { result, unmount } = renderHook((input: SmartSpendPreparationInput) => useSmartSpendPreparation(input), {
        initialProps: baseInput(),
    })
    await flush()
    unmount()
    await act(async () => {
        pending.resolve({ sender: ACCOUNT, nonce: 7n, callData: '0xlate', signature: '0xstub' })
    })
    expect(result.current.takePreparedSmartSpend()).toBeNull()
})

test.each<[string, Partial<SmartSpendPreparationInput>]>([
    ['disabled', { enabled: false }],
    ['no account yet', { accountAddress: undefined }],
    ['no lock (open-amount QR)', { lockCode: null }],
    ['unknown expiry', { lockExpiresAt: null }],
    ['already expired lock', { lockExpiresAt: new Date(NOW - 1_000).toISOString() }],
])('%s: nothing is prepared', async (_label, change) => {
    const { result } = renderHook((input: SmartSpendPreparationInput) => useSmartSpendPreparation(input), {
        initialProps: { ...baseInput(), ...change },
    })
    await flush()
    expect(mockPrepareUserOperation).not.toHaveBeenCalled()
    expect(result.current.takePreparedSmartSpend()).toBeNull()
})

test('disabling after a candidate exists drops it', async () => {
    const { result, rerender } = renderHook((input: SmartSpendPreparationInput) => useSmartSpendPreparation(input), {
        initialProps: baseInput(),
    })
    await flush()
    rerender({ ...baseInput(), enabled: false })
    expect(result.current.takePreparedSmartSpend()).toBeNull()
})

test('a failed preparation is silent and leaves Pay with no candidate', async () => {
    mockPrepareUserOperation.mockRejectedValueOnce(new Error('paymaster refused'))
    const { result } = renderHook((input: SmartSpendPreparationInput) => useSmartSpendPreparation(input), {
        initialProps: baseInput(),
    })
    await flush()
    expect(result.current.takePreparedSmartSpend()).toBeNull()
    expect(mockSignUserOperation).not.toHaveBeenCalled()
})

test('a kernel client that cannot be resolved (not authenticated) is silent too', async () => {
    mockEnsureClientForChain.mockRejectedValueOnce(new Error('not authenticated'))
    const { result } = renderHook((input: SmartSpendPreparationInput) => useSmartSpendPreparation(input), {
        initialProps: baseInput(),
    })
    await flush()
    expect(mockPrepareUserOperation).not.toHaveBeenCalled()
    expect(result.current.takePreparedSmartSpend()).toBeNull()
})

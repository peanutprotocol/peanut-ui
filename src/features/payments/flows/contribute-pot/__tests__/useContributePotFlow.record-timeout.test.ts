import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'

const peer = '0x1111111111111111111111111111111111111111'
const mockCreateCharge = jest.fn()
const mockFetchCharge = jest.fn()
const mockRecordPayment = jest.fn()
const mockSendMoney = jest.fn()
const ctx: Record<string, unknown> = {}
const resetCtx = () =>
    Object.assign(ctx, {
        amount: '33.05',
        usdAmount: '33.05',
        request: { uuid: 'request-1' },
        recipient: { address: peer, userId: 'peer-user' },
        attachment: {},
        contributors: [],
        totalAmount: 99.16,
        totalCollected: 0,
        charge: null,
        error: { showError: false, errorMessage: '' },
        setError: jest.fn(),
        setIsLoading: jest.fn(),
        setCharge: jest.fn(),
        setPayment: jest.fn(),
        setTxHash: jest.fn(),
        setIsSuccess: jest.fn(),
        setCurrentView: jest.fn(),
        refetchRequestPot: jest.fn(),
        setIsExternalWalletPayment: jest.fn(),
    })
jest.mock('../ContributePotFlowContext', () => ({ useContributePotFlowContext: () => ctx }))
jest.mock('@/features/payments/shared/hooks/useChargeManager', () => ({
    useChargeManager: () => ({ createCharge: mockCreateCharge, fetchCharge: mockFetchCharge }),
}))
jest.mock('@/features/payments/shared/hooks/usePaymentRecorder', () => ({
    usePaymentRecorder: () => ({ recordPayment: mockRecordPayment }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        address: '0x2222222222222222222222222222222222222222',
        sendMoney: mockSendMoney,
        hasSufficientSpendableBalance: () => true,
    }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'payer-1' } } }) }))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => String }))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: peer,
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))

import { useContributePotFlow } from '../useContributePotFlow'

const openCharge = (overrides: Record<string, unknown> = {}) => ({
    uuid: 'charge-1',
    tokenAmount: '33.05',
    status: 'PENDING',
    requestLink: { uuid: 'request-1' },
    ...overrides,
})

import * as timeoutTypes from '@/utils/sentry.utils'

const unknownSetter = jest.fn()
function timeoutError(responseReceived = true) {
    const exported = timeoutTypes as unknown as Record<string, { prototype: Error } | undefined>
    const name = responseReceived ? 'MutationResponseTimeoutError' : 'ConnectionTimeoutError'
    return Object.assign(Object.create(exported[name]?.prototype ?? Error.prototype), {
        name,
        message: 'Payment recording timed out',
        ...(responseReceived ? { responseReceived: true, outcomeUnknown: true, status: 201 } : {}),
    }) as Error
}
async function startContribution() {
    const rendered = renderHookWithIntl(() => useContributePotFlow())
    let done: Promise<unknown> | undefined
    act(() => {
        done = rendered.result.current.executeContribution()
    })
    await act(async () => {
        await jest.advanceTimersByTimeAsync(0)
    })
    return { ...rendered, done }
}
async function finishContribution(done: Promise<unknown> | undefined, duration = 65_000) {
    await act(async () => {
        await jest.advanceTimersByTimeAsync(duration)
        await done
    })
}
function expectNoReplayOrGenericFailure() {
    expect(mockSendMoney).toHaveBeenCalledTimes(1)
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
    expect(mockCreateCharge).toHaveBeenCalledTimes(1)
    expect(ctx.setError).not.toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
    expect(ctx.setIsExternalWalletPayment).not.toHaveBeenCalledWith(true)
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    resetCtx()
    Object.assign(ctx, {
        currentView: 'INITIAL',
        isPaymentStatusUnknown: false,
        setIsPaymentStatusUnknown: unknownSetter,
        isSuccess: false,
        isExternalWalletPayment: false,
    })
    mockCreateCharge.mockReset().mockResolvedValue(openCharge())
    mockFetchCharge.mockReset().mockResolvedValue(openCharge({ status: 'PROCESSING' }))
    mockSendMoney.mockReset().mockResolvedValue({ txHash: '0xspent-once' })
    mockRecordPayment.mockReset().mockRejectedValue(timeoutError())
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

it('shows confirming for unknown recording then accepts authoritative completion of the same charge', async () => {
    let resolveRead!: (value: ReturnType<typeof openCharge>) => void
    mockFetchCharge.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolveRead = resolve
            })
    )
    const { done } = await startContribution()
    expect(mockFetchCharge).toHaveBeenCalledWith('charge-1')
    expect(ctx.setCurrentView).not.toHaveBeenCalledWith('STATUS')
    expect(ctx.setIsLoading).toHaveBeenLastCalledWith(true)
    expect(unknownSetter).toHaveBeenCalledWith(true)
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expectNoReplayOrGenericFailure()

    const completed = openCharge({ status: 'COMPLETED', settledAmount: '33.05', partialPayment: false })
    await act(async () => {
        resolveRead(completed)
    })
    await finishContribution(done, 0)
    expect(ctx.setCharge).toHaveBeenLastCalledWith(completed)
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('STATUS')
    expect(ctx.setIsSuccess).toHaveBeenLastCalledWith(true)
    expect(unknownSetter).toHaveBeenLastCalledWith(false)
    expectNoReplayOrGenericFailure()
})

it('keeps exhausted pending read-back in confirming without replay or generic failure', async () => {
    const { done } = await startContribution()
    await finishContribution(done)
    expect(mockFetchCharge).toHaveBeenCalledWith('charge-1')
    expect(mockFetchCharge.mock.calls.length).toBeGreaterThan(0)
    expect(mockFetchCharge.mock.calls.length).toBeLessThanOrEqual(61)
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('STATUS')
    expect(unknownSetter).toHaveBeenLastCalledWith(true)
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expectNoReplayOrGenericFailure()
})

it.each(['FAILED', 'CANCELLED'])('allows generic failure after authoritative %s', async (status) => {
    mockFetchCharge.mockResolvedValue(openCharge({ status }))
    const { done } = await startContribution()
    await finishContribution(done, 0)
    expect(mockFetchCharge).toHaveBeenCalledWith('charge-1')
    expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expect(mockSendMoney).toHaveBeenCalledTimes(1)
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
})

it('keeps a no-response recording timeout as failure without read-back', async () => {
    mockRecordPayment.mockRejectedValue(timeoutError(false))
    const { done } = await startContribution()
    await finishContribution(done, 0)
    expect(mockFetchCharge).not.toHaveBeenCalled()
    expect(unknownSetter).not.toHaveBeenCalledWith(true)
    expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
})

it('does not reconcile charge-creation response uncertainty before spending', async () => {
    mockCreateCharge.mockRejectedValue(timeoutError())
    const { done } = await startContribution()
    await finishContribution(done, 0)
    expect(mockFetchCharge).not.toHaveBeenCalled()
    expect(mockSendMoney).not.toHaveBeenCalled()
    expect(mockRecordPayment).not.toHaveBeenCalled()
    expect(unknownSetter).not.toHaveBeenCalledWith(true)
    expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
})

it('fences late charge completion after leaving the screen', async () => {
    let resolveRead!: (value: ReturnType<typeof openCharge>) => void
    mockFetchCharge.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolveRead = resolve
            })
    )
    const { done, unmount } = await startContribution()
    expect(mockFetchCharge).toHaveBeenCalledWith('charge-1')
    unmount()
    ;(ctx.setCharge as jest.Mock).mockClear()
    ;(ctx.setCurrentView as jest.Mock).mockClear()
    ;(ctx.setIsSuccess as jest.Mock).mockClear()
    await act(async () => {
        resolveRead(openCharge({ status: 'COMPLETED' }))
    })
    await finishContribution(done)
    expect(ctx.setCharge).not.toHaveBeenCalled()
    expect(ctx.setCurrentView).not.toHaveBeenCalled()
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
})

import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'

// TASK-23856: three taps on External wallet created three charges, each with a
// live deposit address. A repeat tap for the same amount reuses the open one.

const peer = '0x1111111111111111111111111111111111111111'
const mockCreateCharge = jest.fn()
const mockFetchCharge = jest.fn()
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
    usePaymentRecorder: () => ({ recordPayment: jest.fn() }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ address: undefined, sendMoney: jest.fn(), hasSufficientSpendableBalance: () => true }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
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

const tapExternalWallet = async () => {
    const { result } = renderHookWithIntl(() => useContributePotFlow())
    let outcome: { success: boolean } | undefined
    await act(async () => {
        outcome = await result.current.executeContribution(true, true)
    })
    return outcome
}

beforeEach(() => {
    jest.clearAllMocks()
    resetCtx()
    mockCreateCharge.mockResolvedValue(openCharge({ uuid: 'charge-new' }))
})

test('the first tap creates a charge', async () => {
    expect(await tapExternalWallet()).toEqual({ success: true })
    expect(mockCreateCharge).toHaveBeenCalledTimes(1)
    expect(ctx.setCharge).toHaveBeenCalledWith(expect.objectContaining({ uuid: 'charge-new' }))
})

// The charge in hand is a snapshot from its creation: it is read again first.
test('a repeat tap for the same amount reuses the charge while it is still PENDING', async () => {
    ctx.charge = openCharge()
    const live = openCharge({ status: 'PENDING' })
    mockFetchCharge.mockResolvedValue(live)

    expect(await tapExternalWallet()).toEqual({ success: true })

    expect(mockFetchCharge).toHaveBeenCalledWith('charge-1')
    expect(mockCreateCharge).not.toHaveBeenCalled()
    expect(ctx.setCharge).toHaveBeenCalledWith(live)
})

test.each([
    ['the reaper failed it', { status: 'FAILED' }],
    ['it already took money', { status: 'COMPLETED' }],
    ['the API sends no status', { status: undefined }],
])('a new charge when %s', async (_, live) => {
    ctx.charge = openCharge()
    mockFetchCharge.mockResolvedValue(openCharge(live))
    await tapExternalWallet()
    expect(mockCreateCharge).toHaveBeenCalledTimes(1)
    expect(ctx.setCharge).toHaveBeenCalledWith(expect.objectContaining({ uuid: 'charge-new' }))
})

test('a new charge when the read fails', async () => {
    ctx.charge = openCharge()
    mockFetchCharge.mockRejectedValue(new Error('offline'))
    await tapExternalWallet()
    expect(mockCreateCharge).toHaveBeenCalledTimes(1)
})

test('a new charge when the open one asks more than the request still needs', async () => {
    ctx.charge = openCharge()
    ctx.totalCollected = 70 // $29.16 left of $99.16; the open charge asks $33.05
    mockFetchCharge.mockResolvedValue(openCharge())
    await tapExternalWallet()
    expect(mockFetchCharge).not.toHaveBeenCalled()
    expect(mockCreateCharge).toHaveBeenCalledTimes(1)
})

test('a changed amount creates a new charge without reading the old one', async () => {
    ctx.charge = openCharge()
    ctx.amount = '58.51'
    ctx.usdAmount = '58.51'
    await tapExternalWallet()
    expect(mockFetchCharge).not.toHaveBeenCalled()
    expect(mockCreateCharge).toHaveBeenCalledWith(expect.objectContaining({ tokenAmount: '58.51' }))
})

// Rhino says "completed" on BRIDGE_EXECUTED, and the API books the payment a
// few seconds later: the charge is read until it is final.
describe('completeExternalWalletPayment', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    const complete = async (runFor: number) => {
        const { result } = renderHookWithIntl(() => useContributePotFlow())
        let done: Promise<void> | undefined
        act(() => {
            done = result.current.completeExternalWalletPayment()
        })
        await act(async () => {
            await jest.advanceTimersByTimeAsync(runFor)
            await done
        })
    }

    test('two PROCESSING reads, then the short payment completes: the payer stays on the deposit card', async () => {
        ctx.charge = openCharge({ tokenAmount: '58.51' })
        const booked = openCharge({
            tokenAmount: '58.51',
            status: 'COMPLETED',
            settledAmount: '33',
            partialPayment: true,
        })
        mockFetchCharge
            .mockResolvedValueOnce(openCharge({ tokenAmount: '58.51', status: 'PROCESSING', settledAmount: null }))
            .mockResolvedValueOnce(openCharge({ tokenAmount: '58.51', status: 'PROCESSING', settledAmount: null }))
            .mockResolvedValueOnce(booked)

        await complete(6_000)

        expect(mockFetchCharge).toHaveBeenCalledTimes(3)
        // the deposit screen stays on its confirming state while the reads run
        expect(ctx.setIsLoading).toHaveBeenNthCalledWith(1, true)
        expect(ctx.setIsLoading).toHaveBeenLastCalledWith(false)
        expect(ctx.setCharge).toHaveBeenLastCalledWith(booked)
        expect(ctx.refetchRequestPot).toHaveBeenCalled()
        // the deposit card reads the short charge and states the rest: no screen change
        expect(ctx.setCurrentView).not.toHaveBeenCalled()
    })

    test('a top-up on a charge that completed short reads until the settled amount moves', async () => {
        const short = openCharge({
            tokenAmount: '58.51',
            status: 'COMPLETED',
            settledAmount: '33',
            partialPayment: true,
        })
        ctx.charge = short
        const booked = openCharge({
            tokenAmount: '58.51',
            status: 'COMPLETED',
            settledAmount: '58.51',
            partialPayment: false,
        })
        // Rhino reported the top-up before the API booked it: the first read still says 33
        mockFetchCharge.mockResolvedValueOnce(short).mockResolvedValueOnce(booked)

        await complete(3_000)

        expect(mockFetchCharge).toHaveBeenCalledTimes(2)
        expect(ctx.setCharge).toHaveBeenLastCalledWith(booked)
        expect(ctx.setCurrentView).toHaveBeenCalledWith('STATUS')
    })

    test('a payment that completes in full shows the success screen', async () => {
        ctx.charge = openCharge({ tokenAmount: '58.51' })
        const booked = openCharge({
            tokenAmount: '58.51',
            status: 'COMPLETED',
            settledAmount: '58.51',
            partialPayment: false,
        })
        mockFetchCharge.mockResolvedValue(booked)

        await complete(0)

        expect(ctx.setCharge).toHaveBeenLastCalledWith(booked)
        expect(ctx.setIsExternalWalletPayment).toHaveBeenCalledWith(true)
        expect(ctx.setCurrentView).toHaveBeenCalledWith('STATUS')
        expect(ctx.refetchRequestPot).toHaveBeenCalled()
    })

    test('a failed charge goes back to the amount screen with an error', async () => {
        ctx.charge = openCharge()
        mockFetchCharge.mockResolvedValue(openCharge({ status: 'FAILED' }))

        await complete(0)

        expect(ctx.setError).toHaveBeenCalledWith({
            showError: true,
            errorMessage: 'This payment could not be confirmed. If money left your wallet, contact support.',
        })
        expect(ctx.setCurrentView).toHaveBeenCalledWith('INITIAL')
        expect(ctx.setCurrentView).not.toHaveBeenCalledWith('STATUS')
        expect(ctx.setIsExternalWalletPayment).not.toHaveBeenCalled()
    })

    test('leaving the deposit screen mid-read stops it: no navigation, nothing busy', async () => {
        ctx.charge = openCharge()
        mockFetchCharge.mockResolvedValue(openCharge({ status: 'PROCESSING' }))
        const { result, unmount } = renderHookWithIntl(() => useContributePotFlow())
        let done: Promise<void> | undefined
        act(() => {
            done = result.current.completeExternalWalletPayment()
        })
        await act(async () => {
            await jest.advanceTimersByTimeAsync(3_000)
        })

        unmount()
        mockFetchCharge.mockResolvedValue(openCharge({ status: 'COMPLETED', settledAmount: '33.05' }))
        await act(async () => {
            await jest.advanceTimersByTimeAsync(60_000)
            await done
        })

        expect(mockFetchCharge.mock.calls.length).toBeLessThanOrEqual(3)
        expect(ctx.setCurrentView).not.toHaveBeenCalled()
        expect(ctx.setCharge).not.toHaveBeenCalled()
        expect(ctx.setIsLoading).toHaveBeenLastCalledWith(false)
    })

    test('a charge still open after a minute shows the result in its confirming form', async () => {
        ctx.charge = openCharge()
        const open = openCharge({ status: 'PROCESSING' })
        mockFetchCharge.mockResolvedValue(open)

        await complete(60_000)

        expect(ctx.setCharge).toHaveBeenLastCalledWith(open)
        expect(ctx.setCurrentView).toHaveBeenCalledWith('STATUS')
        expect(ctx.setIsLoading).toHaveBeenLastCalledWith(false)
    })
})

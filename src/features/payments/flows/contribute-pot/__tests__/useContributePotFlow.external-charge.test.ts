import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'

// TASK-23856: three taps on External wallet created three charges, each with a
// live deposit address. A repeat tap for the same amount reuses the open one.

const peer = '0x1111111111111111111111111111111111111111'
const mockCreateCharge = jest.fn()
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
    })
jest.mock('../ContributePotFlowContext', () => ({ useContributePotFlowContext: () => ctx }))
jest.mock('@/features/payments/shared/hooks/useChargeManager', () => ({
    useChargeManager: () => ({ createCharge: mockCreateCharge }),
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

test('a repeat tap for the same amount reuses the open charge and its address', async () => {
    ctx.charge = openCharge()
    expect(await tapExternalWallet()).toEqual({ success: true })
    expect(mockCreateCharge).not.toHaveBeenCalled()
    expect(ctx.setCharge).not.toHaveBeenCalled()
})

test('an API that sends no charge status still reuses the charge it just created', async () => {
    ctx.charge = openCharge({ status: undefined })
    await tapExternalWallet()
    expect(mockCreateCharge).not.toHaveBeenCalled()
})

test('a changed amount creates a new charge', async () => {
    ctx.charge = openCharge()
    ctx.amount = '58.51'
    ctx.usdAmount = '58.51'
    await tapExternalWallet()
    expect(mockCreateCharge).toHaveBeenCalledWith(expect.objectContaining({ tokenAmount: '58.51' }))
})

test('a charge that already took money is not reused', async () => {
    ctx.charge = openCharge({ status: 'COMPLETED' })
    await tapExternalWallet()
    expect(mockCreateCharge).toHaveBeenCalledTimes(1)
})

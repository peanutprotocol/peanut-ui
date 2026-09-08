import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'

const wallet = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const peer = '0x1111111111111111111111111111111111111111'
const mockCreateCharge = jest.fn()
const mockSendMoney = jest.fn()
const mockRecordPayment = jest.fn()
const ctx = {
    amount: '10',
    usdAmount: '10',
    request: { uuid: 'request-1' },
    recipient: { address: peer, userId: 'peer-user' },
    attachment: {},
    contributors: [],
    totalAmount: 10,
    totalCollected: 0,
    error: { showError: false, errorMessage: '' },
    setError: jest.fn(),
    setIsLoading: jest.fn(),
    setCharge: jest.fn(),
    setPayment: jest.fn(),
    setTxHash: jest.fn(),
    setIsSuccess: jest.fn(),
    setCurrentView: jest.fn(),
}
jest.mock('../ContributePotFlowContext', () => ({ useContributePotFlowContext: () => ctx }))
jest.mock('@/features/payments/shared/hooks/useChargeManager', () => ({
    useChargeManager: () => ({ createCharge: mockCreateCharge }),
}))
jest.mock('@/features/payments/shared/hooks/usePaymentRecorder', () => ({
    usePaymentRecorder: () => ({ recordPayment: mockRecordPayment }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ address: wallet, sendMoney: mockSendMoney, hasSufficientSpendableBalance: () => true }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'payer-user' } } }) }))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => String }))
jest.mock('@/utils/settled-tx-hash.utils', () => ({ resolveSettledTxHash: () => ({ hash: '0xhash' }) }))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: peer,
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))

import { useContributePotFlow } from '../useContributePotFlow'

beforeEach(() => {
    jest.clearAllMocks()
    ctx.recipient = { address: peer, userId: 'peer-user' }
    mockCreateCharge.mockResolvedValue({ uuid: 'charge-1' })
    mockSendMoney.mockResolvedValue({ txHash: '0xhash' })
    mockRecordPayment.mockResolvedValue({ uuid: 'payment-1' })
})

test.each(['address', 'userId'])('blocks own %s before charge creation and sponsored payment', async (identity) => {
    ctx.recipient =
        identity === 'address'
            ? { address: wallet.toUpperCase().replace('0X', '0x'), userId: 'other' }
            : { address: peer, userId: 'payer-user' }
    const { result } = renderHookWithIntl(() => useContributePotFlow())
    expect(result.current.canProceed).toBe(false)
    expect(result.current.error).toEqual({ showError: true, errorMessage: 'You cannot pay your own request.' })
    await act(async () => {
        expect(await result.current.executeContribution()).toEqual({ success: false })
    })
    expect(mockCreateCharge).not.toHaveBeenCalled()
    expect(mockSendMoney).not.toHaveBeenCalled()
    expect(mockRecordPayment).not.toHaveBeenCalled()
    expect(ctx.setError).toHaveBeenCalledWith({ showError: true, errorMessage: 'You cannot pay your own request.' })
})

test('a peer contribution still creates, sends and records', async () => {
    const { result } = renderHookWithIntl(() => useContributePotFlow())
    expect(result.current.error.showError).toBe(false)
    await act(async () => {
        expect(await result.current.executeContribution()).toEqual({ success: true })
    })
    expect(mockCreateCharge).toHaveBeenCalledTimes(1)
    expect(mockSendMoney).toHaveBeenCalledWith(peer, '10', { kind: 'REQUEST_PAY', chargeId: 'charge-1' })
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
})

import { renderHookWithIntl } from '@/test-utils/intl'

const peer = '0x1111111111111111111111111111111111111111'

type Contributor = { uuid: string; amount: string }

const ctx = {
    amount: '',
    usdAmount: '',
    request: { uuid: 'request-1' },
    recipient: { address: peer, userId: 'peer-user' },
    attachment: {},
    contributors: [] as Contributor[],
    totalAmount: 100,
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
    useChargeManager: () => ({ createCharge: jest.fn() }),
}))
jest.mock('@/features/payments/shared/hooks/usePaymentRecorder', () => ({
    usePaymentRecorder: () => ({ recordPayment: jest.fn() }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ address: peer, sendMoney: jest.fn(), hasSufficientSpendableBalance: () => true }),
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

const charge = (amount: string): Contributor => ({ uuid: `charge-${amount}`, amount })

beforeEach(() => {
    ctx.totalAmount = 100
    ctx.totalCollected = 0
    ctx.contributors = []
})

test('an untouched pot suggests the whole amount', () => {
    const { result } = renderHookWithIntl(() => useContributePotFlow())
    expect(result.current.sliderDefaults).toEqual({ percentage: 100, suggestedAmount: 100 })
})

test('a bank deposit the payer cannot see as a charge still caps the suggestion', () => {
    // $60 in by bank, no charges: $40 is left, and the payer must not be
    // prefilled with the full $100.
    ctx.totalCollected = 60
    const { result } = renderHookWithIntl(() => useContributePotFlow())
    expect(result.current.sliderDefaults.suggestedAmount).toBe(40)
    expect(result.current.sliderDefaults.percentage).toBe(100)
})

test('bank and charge money together cap the suggestion at what is left', () => {
    // $60 by bank plus a $30 charge leaves $10. The median-charge suggestion
    // would be $30 — three times the remainder.
    ctx.totalCollected = 90
    ctx.contributors = [charge('30')]
    const { result } = renderHookWithIntl(() => useContributePotFlow())
    expect(result.current.sliderDefaults.suggestedAmount).toBe(10)
    expect(result.current.sliderDefaults.percentage).toBe(100)
})

test('a covered pot suggests nothing', () => {
    ctx.totalCollected = 120
    ctx.contributors = [charge('120')]
    const { result } = renderHookWithIntl(() => useContributePotFlow())
    expect(result.current.sliderDefaults).toEqual({ percentage: 0, suggestedAmount: 0 })
})

test('an equal split still suggests a third of the pot while it fits', () => {
    ctx.totalCollected = 33.33
    ctx.contributors = [charge('33.33')]
    const { result } = renderHookWithIntl(() => useContributePotFlow())
    expect(result.current.sliderDefaults.suggestedAmount).toBeCloseTo(33.33, 2)
    // the slider spans what is left ($66.67), so a third of the pot is half of it
    expect(result.current.sliderDefaults.percentage).toBeCloseTo(50, 1)
})

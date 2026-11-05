/**
 * The "insufficient balance" error waits for the LIVE balance. A cached total
 * on screen (even $0) is display only: while the live terms are pending the
 * flow cannot know the payer is short, and must not say so.
 *
 * The real `useWallet` runs here; only its inputs are mocked.
 */
import { waitFor } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'

const WALLET_ADDRESS = '0x1111111111111111111111111111111111111111'
const USER_ID = 'payer'

const ctx = {
    amount: '0.50',
    usdAmount: '0.50',
    request: { uuid: 'request-1' },
    recipient: { address: '0x2222222222222222222222222222222222222222', userId: 'peer-user' },
    attachment: {},
    contributors: [],
    totalAmount: 10,
    totalCollected: 0,
    isLoading: false,
    error: { showError: false, errorMessage: '' },
}
jest.mock('../ContributePotFlowContext', () => ({ useContributePotFlowContext: () => ctx }))
jest.mock('@/features/payments/shared/hooks/useChargeManager', () => ({
    useChargeManager: () => ({ createCharge: jest.fn(), isCreating: false }),
}))
jest.mock('@/features/payments/shared/hooks/usePaymentRecorder', () => ({
    usePaymentRecorder: () => ({ recordPayment: jest.fn(), isRecording: false }),
}))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => String }))

let mockUser: unknown
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))

// the live inputs of useWallet
let mockSmart: { data: bigint | undefined; isLoading: boolean }
let mockRainOverview: { balance: { spendingPower: number } | null } | undefined
jest.mock('@/hooks/wallet/useBalance', () => ({
    useBalance: (address: string | undefined) =>
        address ? { ...mockSmart, refetch: jest.fn() } : { data: undefined, isLoading: false, refetch: jest.fn() },
}))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: mockRainOverview, isLoading: false }),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('@tanstack/react-query', () => ({
    ...jest.requireActual('@tanstack/react-query'),
    useIsFetching: () => 0,
}))
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ address: WALLET_ADDRESS, isKernelClientReady: true, handleSendUserOpEncoded: jest.fn() }),
}))
jest.mock('@/hooks/wallet/useSendMoney', () => ({ useSendMoney: () => ({ mutateAsync: jest.fn() }) }))
jest.mock('@/hooks/wallet/useSpendBundle', () => ({ useSpendBundle: () => ({ spend: jest.fn() }) }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))

import { useContributePotFlow } from '../useContributePotFlow'
import { useWallet } from '@/hooks/wallet/useWallet'
import { writeLastKnownSpendable } from '@/hooks/wallet/lastKnownSpendable'

const usd = (amount: number) => BigInt(Math.round(amount * 1e6))
const signedIn = { user: { userId: USER_ID }, accounts: [{ type: 'peanut-wallet', identifier: WALLET_ADDRESS }] }

/** the flow next to what the same wallet hook puts on screen */
const renderFlow = () =>
    renderHookWithIntl(() => {
        const { isFetchingSpendableBalance, spendableBalance } = useWallet()
        return { flow: useContributePotFlow(), isFetchingSpendableBalance, spendableBalance }
    })

beforeEach(() => {
    localStorage.clear()
    mockUser = signedIn
    mockSmart = { data: 0n, isLoading: false }
    mockRainOverview = undefined
})

describe('useContributePotFlow — insufficient balance waits for the live balance', () => {
    it.each([
        ['$3.90', 3.9],
        ['$0', 0],
    ])('says nothing while Rain is pending behind a cached %s', async (_, cached) => {
        writeLastKnownSpendable(USER_ID, usd(cached))
        const { result } = renderFlow()

        // the display has settled on the cached number and does not read as loading
        await waitFor(() => expect(result.current.spendableBalance).toBe(usd(cached)))
        expect(result.current.isFetchingSpendableBalance).toBe(false)

        expect(result.current.flow.isInsufficientBalance).toBe(false)
        // and the pay gate still holds: nothing live says the payer can afford it
        expect(result.current.flow.hasSufficientBalance).toBe(false)
    })

    it('reports a live balance that is short', () => {
        mockRainOverview = { balance: { spendingPower: 10 } } // $0.10 collateral
        const { result } = renderFlow()

        expect(result.current.flow.isInsufficientBalance).toBe(true)
        expect(result.current.flow.hasSufficientBalance).toBe(false)
    })

    it('counts collateral: an empty wallet with enough on the card is not short', () => {
        mockRainOverview = { balance: { spendingPower: 390 } }
        const { result } = renderFlow()

        expect(result.current.flow.isInsufficientBalance).toBe(false)
        expect(result.current.flow.hasSufficientBalance).toBe(true)
    })

    it('says nothing to a signed-out payer', () => {
        mockUser = null
        mockRainOverview = { balance: { spendingPower: 10 } }
        const { result } = renderFlow()

        expect(result.current.flow.isInsufficientBalance).toBe(false)
    })
})

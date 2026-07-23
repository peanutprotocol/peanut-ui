/**
 * Regression tests for the displayed spendable balance (PEANUT-UI-QD5).
 *
 * `/rain/cards` supplies BOTH Rain terms of `smart + spendingPower + inTransit`.
 * When it hasn't answered, those terms fold to 0n — indistinguishable from "this
 * user has no collateral" — so a card user whose funds the auto-balancer swept
 * into collateral was shown a confident, wrong $0.
 *
 * The contract these lock down:
 *  1. Rain unavailable + no cache      → undefined (UI shows a loader, never $0)
 *  2. Rain unavailable + cached value  → cached value, flagged stale
 *  3. Rain answers                     → live sum, not stale, cache written
 *  4. The affordability gate NEVER reads the cache
 */

import { renderHook, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import type { ReactNode } from 'react'

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_TOKEN: '0x1234567890123456789012345678901234567890',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
    PEANUT_WALLET_CHAIN: { id: 42161 },
}))

const WALLET_ADDRESS = '0x1111111111111111111111111111111111111111'
const USER_ID = 'user-under-test'

let mockSmartBalance: bigint | undefined
let mockRainOverview:
    | {
          balance: { spendingPower: number; inTransitToCollateralCents?: number } | null
          balanceUnavailable?: boolean
      }
    | undefined
let mockAnyFetching: boolean

jest.mock('../useBalance', () => ({
    useBalance: () => ({ data: mockSmartBalance, isLoading: false, refetch: jest.fn() }),
}))

jest.mock('../../useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: mockRainOverview, isLoading: false }),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))

jest.mock('@tanstack/react-query', () => ({
    useIsFetching: () => (mockAnyFetching ? 1 : 0),
}))

jest.mock('../../useZeroDev', () => ({
    useZeroDev: () => ({ address: WALLET_ADDRESS, isKernelClientReady: true, handleSendUserOpEncoded: jest.fn() }),
}))

let mockUserId: string = USER_ID
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: {
            user: { userId: mockUserId },
            accounts: [{ type: 'peanut-wallet', identifier: WALLET_ADDRESS }],
        },
    }),
}))

jest.mock('../useSendMoney', () => ({ useSendMoney: () => ({ mutateAsync: jest.fn() }) }))
jest.mock('../useSpendBundle', () => ({ useSpendBundle: () => ({ spend: jest.fn() }) }))
let mockDemoMode = false
let mockDemoBalanceUnits: bigint | undefined
jest.mock('@/utils/demo', () => ({ isDemoMode: () => mockDemoMode }))
jest.mock('@/utils/demo-balance', () => ({ useDemoBalanceUnits: () => mockDemoBalanceUnits }))

// imports must come after the jest.mock calls above
import { useWallet } from '../useWallet'
import store from '@/redux/store'
import { readLastKnownSpendable, writeLastKnownSpendable } from '../lastKnownSpendable'

const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>

const usd = (amount: number) => BigInt(Math.round(amount * 1e6))

beforeEach(() => {
    localStorage.clear()
    mockUserId = USER_ID
    mockSmartBalance = undefined
    mockRainOverview = undefined
    mockAnyFetching = false
    mockDemoMode = false
    mockDemoBalanceUnits = undefined
})

describe('useWallet spendable balance', () => {
    it('does not report $0 when /rain/cards is unavailable and nothing is cached', async () => {
        // The exact production shape: funds swept into collateral, so the smart
        // account really is 0 — the total is only wrong because Rain is missing.
        mockSmartBalance = 0n
        mockRainOverview = undefined

        const { result } = renderHook(() => useWallet(), { wrapper })

        await waitFor(() => expect(result.current.isFetchingSpendableBalance).toBe(true))
        expect(result.current.spendableBalance).toBeUndefined()
    })

    it('paints the cached last-known total when /rain/cards is unavailable', async () => {
        writeLastKnownSpendable(USER_ID, usd(120.5))
        mockSmartBalance = 0n
        mockRainOverview = undefined

        const { result } = renderHook(() => useWallet(), { wrapper })

        await waitFor(() => expect(result.current.spendableBalance).toBe(usd(120.5)))
        expect(result.current.isSpendableBalanceStale).toBe(true)
        expect(result.current.isFetchingSpendableBalance).toBe(false)
        expect(result.current.formattedSpendableBalance).toBe('120.5')
    })

    it('replaces the cached value with the live sum once Rain answers, and re-caches it', async () => {
        writeLastKnownSpendable(USER_ID, usd(120.5))
        mockSmartBalance = usd(10)
        mockRainOverview = { balance: { spendingPower: 9000, inTransitToCollateralCents: 500 } } // $90 + $5

        const { result } = renderHook(() => useWallet(), { wrapper })

        await waitFor(() => expect(result.current.spendableBalance).toBe(usd(105)))
        expect(result.current.isSpendableBalanceStale).toBe(false)
        await waitFor(() => expect(readLastKnownSpendable(USER_ID)).toBe(usd(105)))
    })

    it('never caches a total computed without Rain', async () => {
        mockSmartBalance = usd(7)
        mockRainOverview = undefined

        renderHook(() => useWallet(), { wrapper })

        await waitFor(() => expect(readLastKnownSpendable(USER_ID)).toBeUndefined())
    })

    // The backend answered, but couldn't reach Rain. Summing its absent
    // spendingPower as 0 is the same $0 bug via a response that "succeeded".
    it('treats balanceUnavailable with no balance as not-ready and holds the cache', async () => {
        writeLastKnownSpendable(USER_ID, usd(80))
        mockSmartBalance = 0n
        mockRainOverview = { balance: null, balanceUnavailable: true }

        const { result } = renderHook(() => useWallet(), { wrapper })

        await waitFor(() => expect(result.current.spendableBalance).toBe(usd(80)))
        expect(result.current.isSpendableBalanceStale).toBe(true)
        expect(readLastKnownSpendable(USER_ID)).toBe(usd(80)) // not overwritten with 0
    })

    // A stale-but-present balance is still better than the FE's own older cache.
    it('uses a stale served balance when the backend flags it unavailable', async () => {
        writeLastKnownSpendable(USER_ID, usd(80))
        mockSmartBalance = usd(5)
        mockRainOverview = { balance: { spendingPower: 3_000 }, balanceUnavailable: true }

        const { result } = renderHook(() => useWallet(), { wrapper })

        await waitFor(() => expect(result.current.spendableBalance).toBe(usd(35)))
        expect(result.current.isSpendableBalanceStale).toBe(false)
        // ...but a served-stale value must never refresh the last-known-good
        // cache — that is reserved for authoritative live reads.
        expect(readLastKnownSpendable(USER_ID)).toBe(usd(80))
    })

    it('does not paint the previous user’s settled total after an account switch', async () => {
        mockSmartBalance = usd(100)
        mockRainOverview = { balance: { spendingPower: 0 } }

        const { result, rerender } = renderHook(() => useWallet(), { wrapper })
        await waitFor(() => expect(result.current.spendableBalance).toBe(usd(100)))

        // Switch account: Rain hasn't answered for user B and B has no cache —
        // the UI must show a loader, not user A's number.
        mockUserId = 'user-b'
        mockRainOverview = undefined
        rerender()

        await waitFor(() => expect(result.current.spendableBalance).toBeUndefined())
    })

    it('writes the new user’s cache after a switch even when the totals are equal', async () => {
        mockSmartBalance = usd(100)
        mockRainOverview = { balance: { spendingPower: 0 } }

        const { rerender } = renderHook(() => useWallet(), { wrapper })
        await waitFor(() => expect(readLastKnownSpendable(USER_ID)).toBe(usd(100)))

        mockUserId = 'user-b'
        rerender()

        await waitFor(() => expect(readLastKnownSpendable('user-b')).toBe(usd(100)))
    })

    // A user with no card legitimately has no Rain balance — that must stay a
    // real answer, or they'd never see their plain smart-account total.
    it('treats a null balance without the flag as a real zero', async () => {
        mockSmartBalance = usd(12)
        mockRainOverview = { balance: null, balanceUnavailable: false }

        const { result } = renderHook(() => useWallet(), { wrapper })

        await waitFor(() => expect(result.current.spendableBalance).toBe(usd(12)))
        expect(result.current.isSpendableBalanceStale).toBe(false)
    })

    // Demo makes no /rain/cards call, so gating the display on a Rain response
    // would strand the demo home screen on a loader forever.
    it('shows the synthesized demo balance without waiting on Rain', async () => {
        mockDemoMode = true
        mockDemoBalanceUnits = usd(42)
        mockRainOverview = undefined

        const { result } = renderHook(() => useWallet(), { wrapper })

        await waitFor(() => expect(result.current.spendableBalance).toBe(usd(42)))
        expect(result.current.isFetchingSpendableBalance).toBe(false)
        expect(result.current.isSpendableBalanceStale).toBe(false)
        // demo must never pollute the real user's cached total
        expect(readLastKnownSpendable(USER_ID)).toBeUndefined()
    })

    it('keeps the affordability gate on live data, never the cache', async () => {
        writeLastKnownSpendable(USER_ID, usd(500))
        mockSmartBalance = 0n
        mockRainOverview = undefined

        const { result } = renderHook(() => useWallet(), { wrapper })

        // The cached $500 is on screen, but nothing is actually spendable yet.
        await waitFor(() => expect(result.current.spendableBalance).toBe(usd(500)))
        expect(result.current.hasSufficientSpendableBalance('100')).toBe(false)
    })
})

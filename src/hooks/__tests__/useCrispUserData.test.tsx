/**
 * The load-bearing invariant of the support snapshot: it reports on queries it
 * must never subscribe to.
 *
 * SupportDrawer mounts this hook app-wide — on every screen, for guests too. A
 * `useWallet()` / `useLimits()` / `useRainCardOverview()` call inside it would
 * switch on a 30s RPC poll and two API requests for every user, which is the
 * exact shape of the regression that made /rain/cards the most-called endpoint
 * in the app. So the hook reads the react-query cache and nothing else.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useAuth } from '@/context/authContext'
import { useSupportClientContext } from '@/hooks/useSupportClientContext'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { TRANSACTIONS } from '@/constants/query.consts'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { AccountType } from '@/interfaces/interfaces'

jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))
jest.mock('@/hooks/useSupportClientContext', () => ({ useSupportClientContext: jest.fn() }))
const modalsState = { isSupportModalOpen: true }
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => modalsState }))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockClientContext = useSupportClientContext as jest.MockedFunction<typeof useSupportClientContext>

const WALLET = '0xb8ed0b7578e658cb6718ae92facb98f718d445e3'

const wrapper = (client: QueryClient) =>
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }

describe('useCrispUserData', () => {
    let client: QueryClient

    beforeEach(() => {
        jest.clearAllMocks()
        modalsState.isSupportModalOpen = true
        client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        mockClientContext.mockReturnValue({
            platform: 'ios-native',
            appBuild: 'web:9f3ac1 · native:1.0.8 (42)',
            locale: 'es-419',
            routeOnOpen: '/withdraw/manteca',
            isOffline: false,
            isApiUnreachable: false,
            notificationPermission: 'granted',
        })
        mockUseAuth.mockReturnValue({
            username: 'glorfindel',
            userId: 'user-1',
            user: {
                user: { userId: 'user-1', email: 'a@b.co', fullName: 'Glor Findel' },
                accounts: [{ type: AccountType.PEANUT_WALLET, identifier: WALLET }],
                totalPoints: 1240,
            },
        } as unknown as ReturnType<typeof useAuth>)
    })

    it('starts no queries of its own', () => {
        renderHook(() => useCrispUserData(), { wrapper: wrapper(client) })

        expect(client.getQueryCache().findAll()).toHaveLength(0)
    })

    it('reports unavailable rather than zero when nothing is cached', () => {
        const { result } = renderHook(() => useCrispUserData(), { wrapper: wrapper(client) })

        expect(result.current.balance).toContain('unavailable')
        expect(result.current.balance).not.toContain('$0.00')
        expect(result.current.latestActivity).toBeUndefined()
        expect(result.current.segments).toContain('balance-unavailable')
    })

    it('picks up a warm cache without touching the network', () => {
        client.setQueryData(['balance', WALLET], 100_000_000n)
        client.setQueryData([RAIN_CARD_OVERVIEW_QUERY_KEY, 'user-1'], {
            status: { hasApplication: false },
            balance: null,
            cards: [],
        })
        client.setQueryData([TRANSACTIONS, 'latest', { limit: 5, targetUsername: undefined }], {
            entries: [
                {
                    uuid: 'tx-1',
                    timestamp: new Date(),
                    status: 'COMPLETED',
                    amount: '25.00',
                    tokenSymbol: 'USDC',
                    userRole: 'SENDER',
                    extraData: { kind: 'P2P_SEND' },
                    recipientAccount: { username: 'bob', identifier: 'bob.eth', type: 'peanut-wallet', isUser: true },
                },
            ],
            hasMore: false,
        })

        const { result } = renderHook(() => useCrispUserData(), { wrapper: wrapper(client) })

        expect(result.current.balance).toBe('$100.00 spendable (wallet $100.00 · card $0.00)')
        expect(result.current.latestActivity).toContain('P2P_SEND')
        expect(result.current.latestActivity).not.toContain('bob')
        expect(result.current.accountStats).toContain('1240 pts')
        expect(result.current.appContext).toContain('route:/withdraw/manteca')
        expect(
            client
                .getQueryCache()
                .findAll()
                .every((query) => query.state.fetchStatus === 'idle')
        ).toBe(true)
    })

    /*
     * The consumer pushes to Crisp on every identity change, and the cache reads
     * build a fresh object each render — so identity has to track the VALUE, or
     * every unrelated re-render of the drawer would postMessage the iframe again.
     */
    it('keeps a stable identity while the underlying values are unchanged', () => {
        const { result, rerender } = renderHook(() => useCrispUserData(), { wrapper: wrapper(client) })
        const first = result.current

        rerender()
        expect(result.current).toBe(first)

        client.setQueryData(['balance', WALLET], 100_000_000n)
        rerender()
        expect(result.current).not.toBe(first)
    })

    /*
     * The cache reads are not subscriptions, so a query resolving after support
     * opened would otherwise never reach the sidebar: the agent reads
     * `unavailable` for the whole conversation and routes on a
     * `balance-unavailable` segment, accurate at the instant it was read and
     * wrong a second later.
     */
    it('picks up a query that resolves after support is already open', async () => {
        const { result } = renderHook(() => useCrispUserData(), { wrapper: wrapper(client) })
        expect(result.current.balance).toContain('unavailable')

        await act(async () => {
            client.setQueryData(['balance', WALLET], 100_000_000n)
            client.setQueryData([RAIN_CARD_OVERVIEW_QUERY_KEY, 'user-1'], {
                status: { hasApplication: false },
                balance: null,
                cards: [],
            })
        })

        expect(result.current.balance).toBe('$100.00 spendable (wallet $100.00 · card $0.00)')
        expect(result.current.segments).not.toContain('balance-unavailable')
    })

    it('does not watch the cache while support is closed', async () => {
        modalsState.isSupportModalOpen = false
        const { result } = renderHook(() => useCrispUserData(), { wrapper: wrapper(client) })
        const before = result.current

        await act(async () => {
            client.setQueryData(['balance', WALLET], 100_000_000n)
        })

        expect(result.current).toBe(before)
    })
})

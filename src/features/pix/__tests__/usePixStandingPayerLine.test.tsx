/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import en from '@/i18n/app/messages/en.json'

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ userId: 'u1' }) }))
const mockFetch = jest.fn()
jest.mock('@/services/deposit-accounts', () => ({ fetchDepositAccounts: () => mockFetch() }))

import { DEPOSIT_ACCOUNTS_QUERY_KEY } from '@/features/deposit-accounts/useDepositAccounts'
import { usePixStandingPayerLine } from '../usePixStandingPayerLine'

const brlAccount = (sender: string, status = 'active') => ({
    id: 'a1',
    railId: 'bridge.pix_br',
    country: 'BRA',
    currency: 'BRL',
    status,
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender },
})
const snapshot = (accounts: unknown[], claimable: unknown[] = []) => ({ accounts, claimable, unavailable: [] })

describe('usePixStandingPayerLine', () => {
    let queryClient: QueryClient
    const answered = () =>
        waitFor(() => expect(queryClient.getQueryState([...DEPOSIT_ACCOUNTS_QUERY_KEY, 'u1'])?.status).toBe('success'))
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <NextIntlClientProvider locale="en" messages={en}>
                {children}
            </NextIntlClientProvider>
        </QueryClientProvider>
    )
    beforeEach(() => {
        jest.clearAllMocks()
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })

    it("says who may pay from the BRL account's own terms", async () => {
        mockFetch.mockResolvedValue(snapshot([brlAccount('business-only')]))
        const { result } = renderHook(() => usePixStandingPayerLine(true), { wrapper })
        await waitFor(() => expect(result.current).toBe(en.depositAccounts.senderLimit.businessOnly.line))
    })

    it('reads the terms the account would carry before the first code opens it', async () => {
        mockFetch.mockResolvedValue(
            snapshot([], [{ railId: 'bridge.pix_br', currency: 'BRL', matching: { sender: 'business-only' } }])
        )
        const { result } = renderHook(() => usePixStandingPayerLine(true), { wrapper })
        await waitFor(() => expect(result.current).toBe(en.depositAccounts.senderLimit.businessOnly.line))
    })

    it('reads no other account, and none that is closed', async () => {
        mockFetch.mockResolvedValue(
            snapshot([
                { ...brlAccount('business-only'), railId: 'bridge.sepa_eu' },
                brlAccount('business-only', 'revoked'),
            ])
        )
        const { result } = renderHook(() => usePixStandingPayerLine(true), { wrapper })
        await answered()
        expect(result.current).toBeUndefined()
    })

    it('says nothing where anyone may pay in', async () => {
        mockFetch.mockResolvedValue(snapshot([brlAccount('anyone')]))
        const { result } = renderHook(() => usePixStandingPayerLine(true), { wrapper })
        await answered()
        expect(result.current).toBeUndefined()
    })

    it('reads nothing for a route that is not standing', () => {
        renderHook(() => usePixStandingPayerLine(false), { wrapper })
        expect(mockFetch).not.toHaveBeenCalled()
    })
})

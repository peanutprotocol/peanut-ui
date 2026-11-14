/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import en from '@/i18n/app/messages/en.json'
import { loadMessages } from '@/i18n/app/messages'

let mockUserId: string | undefined = 'u1'
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ userId: mockUserId }) }))
const mockRules = jest.fn()
jest.mock('@/services/pix', () => ({ pixApi: { depositRules: () => mockRules() } }))

import { usePixDepositMarketLines } from '../usePixDepositMarketLines'

// API-CONTRACT 8.2: Bridge's route adds its mid-market rate and its cut of a deposit to the rules
const BRIDGE_RULES = { minAmountBrl: '25', blockedBanks: [], marketRate: '5.714286', providerFeePercent: '0.57' }

const wrapperFor = (locale: string, messages: unknown) =>
    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <NextIntlClientProvider locale={locale} messages={messages as typeof en} timeZone="UTC">
                    {children}
                </NextIntlClientProvider>
            </QueryClientProvider>
        )
    }
const wrapper = wrapperFor('en', en)

describe('usePixDepositMarketLines', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockUserId = 'u1'
    })

    it("states the provider's market rate and its cut of each Pix", async () => {
        mockRules.mockResolvedValue(BRIDGE_RULES)
        const { result } = renderHook(() => usePixDepositMarketLines(true), { wrapper })

        await waitFor(() =>
            expect(result.current).toEqual([
                'The exchange rate is 1 USD = BRL 5.7143.',
                'The provider fee is 0.57% of each Pix.',
            ])
        )
    })

    it('writes the percentage the way the locale does', async () => {
        mockRules.mockResolvedValue(BRIDGE_RULES)
        const messages = await loadMessages('pt-BR')
        const { result } = renderHook(() => usePixDepositMarketLines(true), { wrapper: wrapperFor('pt-BR', messages) })

        await waitFor(() => expect(result.current[1]).toBe('A taxa do provedor é de 0,57% de cada Pix.'))
    })

    // Manteca's route, or Bridge's rates unread within 1.5 s: the rules carry neither field
    it('shows no line without the fields, and none while the answer is out', async () => {
        mockRules.mockResolvedValue({ minAmountBrl: '25', blockedBanks: [] })
        const { result } = renderHook(() => usePixDepositMarketLines(true), { wrapper })

        expect(result.current).toEqual([])
        await waitFor(() => expect(mockRules).toHaveBeenCalledTimes(1))
        expect(result.current).toEqual([])
    })

    it('shows no line and no error when the call fails', async () => {
        mockRules.mockRejectedValue(new Error('down'))
        const { result } = renderHook(() => usePixDepositMarketLines(true), { wrapper })

        await waitFor(() => expect(mockRules).toHaveBeenCalledTimes(1))
        expect(result.current).toEqual([])
    })

    it('asks nothing for a code that is not the standing one, or for no account', () => {
        renderHook(() => usePixDepositMarketLines(false), { wrapper })
        mockUserId = undefined
        renderHook(() => usePixDepositMarketLines(true), { wrapper })

        expect(mockRules).not.toHaveBeenCalled()
    })
})

import { renderHook } from '@testing-library/react'
import { useLimitsValidation } from '../useLimitsValidation'
import type { UserLimitsResponse } from '@/interfaces/interfaces'

let mockLimits: UserLimitsResponse
let mockRoutes: Array<{ operation: string; method: string; provider?: string; state: string }> = []

jest.mock('@/hooks/useLimits', () => ({
    useLimits: () => ({
        limits: mockLimits,
        mantecaLimits: mockLimits.manteca,
        bridgeLimits: mockLimits.bridge,
        aveniaLimits: mockLimits.avenia ?? null,
        isLoading: false,
        hasMantecaLimits: !!mockLimits.manteca && mockLimits.manteca.length > 0,
        hasBridgeLimits: !!mockLimits.bridge,
    }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ capabilities: { rails: [], nextActions: [], restrictions: [], routes: mockRoutes } }),
}))

// Manteca's BRL limit, in USDT as Manteca answers it: $100 left this month
const MANTECA_BRL = {
    exchangeCountry: 'BRA',
    type: 'EXCHANGE' as const,
    asset: 'BRL',
    yearlyLimit: '12000',
    availableYearlyLimit: '1000',
    monthlyLimit: '1000',
    availableMonthlyLimit: '100',
}
const AVENIA = {
    currency: 'BRL' as const,
    deposit: { brlLeft: '120000.00', usdLeft: '18500.00', blocked: false },
    payout: { brlLeft: '2000.00', usdLeft: '370.00', blocked: false },
}
const pixRoutes = (provider: string) =>
    ['deposit', 'withdraw', 'pay'].map((operation) => ({ operation, method: 'PIX_BR', provider, state: 'ready' }))

describe('useLimitsValidation: a BRL operation reads the limits of the provider its route names', () => {
    beforeEach(() => {
        mockLimits = { manteca: [MANTECA_BRL], bridge: null, avenia: AVENIA }
    })

    it('checks an Avenia QR payment against Avenia’s payout room, not Manteca’s smaller BRL limit', () => {
        mockRoutes = pixRoutes('avenia')
        const { result } = renderHook(() =>
            useLimitsValidation({ flowType: 'qr-payment', amount: '200', currency: 'BRL' })
        )
        expect(result.current.isBlocking).toBe(false)
        expect(result.current.remainingLimit).toBe(370)
        expect(result.current.limitCurrency).toBe('USD')
        expect(result.current.servedByAvenia).toBe(true)
    })

    it('blocks an Avenia withdrawal over the USD left this month, with the reset days', () => {
        mockRoutes = pixRoutes('avenia')
        const { result } = renderHook(() =>
            useLimitsValidation({ flowType: 'offramp', amount: '400', currency: 'BRL' })
        )
        expect(result.current.isBlocking).toBe(true)
        expect(result.current.remainingLimit).toBe(370)
        expect(result.current.daysUntilReset).toBeGreaterThan(0)
    })

    it('reads Pix in for a deposit, and a blocked room blocks any amount', () => {
        mockRoutes = pixRoutes('avenia')
        mockLimits = {
            manteca: null,
            bridge: null,
            avenia: { ...AVENIA, deposit: { brlLeft: null, usdLeft: null, blocked: true } },
        }
        const { result } = renderHook(() => useLimitsValidation({ flowType: 'onramp', amount: '1', currency: 'BRL' }))
        expect(result.current.isBlocking).toBe(true)
        expect(result.current.remainingLimit).toBe(0)
    })

    it('keeps Manteca’s limit when the route names Manteca', () => {
        mockRoutes = pixRoutes('manteca')
        const { result } = renderHook(() =>
            useLimitsValidation({ flowType: 'qr-payment', amount: '200', currency: 'BRL' })
        )
        expect(result.current.isBlocking).toBe(true)
        expect(result.current.remainingLimit).toBe(100)
        expect(result.current.servedByAvenia).toBe(false)
    })

    it('checks nothing locally while Avenia’s room is unread: the API’s refusal still holds', () => {
        mockRoutes = pixRoutes('avenia')
        mockLimits = { manteca: [MANTECA_BRL], bridge: null, avenia: null }
        const { result } = renderHook(() =>
            useLimitsValidation({ flowType: 'qr-payment', amount: '200', currency: 'BRL' })
        )
        expect(result.current.isBlocking).toBe(false)
        expect(result.current.remainingLimit).toBeNull()
    })

    it('leaves ARS on Manteca whatever the Pix routes say', () => {
        mockRoutes = pixRoutes('avenia')
        mockLimits = { manteca: [{ ...MANTECA_BRL, asset: 'ARS', exchangeCountry: 'ARG' }], bridge: null }
        const { result } = renderHook(() =>
            useLimitsValidation({ flowType: 'qr-payment', amount: '200', currency: 'ARS' })
        )
        expect(result.current.isBlocking).toBe(true)
        expect(result.current.remainingLimit).toBe(100)
    })
})

jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import type { UserLimitsResponse } from '@/interfaces/interfaces'
import MantecaLimitsView from '../MantecaLimitsView'

let mockLimits: UserLimitsResponse
let mockRoutes: Array<{ operation: string; method: string; provider?: string; state: string }> = []

jest.mock('@/hooks/useLimits', () => ({
    useLimits: () => ({
        mantecaLimits: mockLimits.manteca,
        aveniaLimits: mockLimits.avenia ?? null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        isRefetching: false,
    }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ capabilities: { rails: [], nextActions: [], restrictions: [], routes: mockRoutes } }),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/features/attention/AttentionSlot', () => ({ AttentionSlot: () => null }))
jest.mock('../../components/IncreaseLimitsButton', () => ({ __esModule: true, default: () => null }))
jest.mock('../../components/LimitsDocsLink', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))

const limit = (asset: string, exchangeCountry: string) => ({
    exchangeCountry,
    type: 'EXCHANGE' as const,
    asset,
    yearlyLimit: '12000',
    availableYearlyLimit: '9000',
    monthlyLimit: '1000',
    availableMonthlyLimit: '800',
})
const AVENIA = {
    currency: 'BRL' as const,
    deposit: { brlLeft: '120000.00', usdLeft: '18500.00', blocked: false },
    payout: { brlLeft: '2000.00', usdLeft: '370.00', blocked: false },
}
const pixRoutes = (provider: string, operations = ['deposit', 'withdraw', 'pay']) =>
    operations.map((operation) => ({ operation, method: 'PIX_BR', provider, state: 'ready' }))

describe('the LATAM limits screen shows the limits of the provider that serves each currency', () => {
    it('shows Avenia’s monthly room for BRL in place of Manteca’s BRL card, and keeps ARS on Manteca', () => {
        mockLimits = { manteca: [limit('ARS', 'ARG'), limit('BRL', 'BRA')], bridge: null, avenia: AVENIA }
        mockRoutes = pixRoutes('avenia')
        render(<MantecaLimitsView />)

        expect(screen.getByText('BRL left this month')).toBeInTheDocument()
        expect(screen.getByText('Add money')).toBeInTheDocument()
        expect(screen.getByText('Withdraw and pay')).toBeInTheDocument()
        expect(screen.getByText('ARS total allowed')).toBeInTheDocument()
        expect(screen.queryByText('BRL total allowed')).not.toBeInTheDocument()
    })

    it('shows only the payout room to a user whose deposits are not Avenia’s (a resident abroad)', () => {
        mockLimits = { manteca: null, bridge: null, avenia: AVENIA }
        mockRoutes = [
            ...pixRoutes('avenia', ['withdraw', 'pay']),
            { operation: 'deposit', method: 'PIX_BR', state: 'refused' },
        ]
        render(<MantecaLimitsView />)

        expect(screen.getByText('Withdraw and pay')).toBeInTheDocument()
        expect(screen.queryByText('Add money')).not.toBeInTheDocument()
    })

    it('keeps Manteca’s BRL card while the Pix routes name Manteca', () => {
        mockLimits = { manteca: [limit('BRL', 'BRA')], bridge: null, avenia: null }
        mockRoutes = pixRoutes('manteca')
        render(<MantecaLimitsView />)

        expect(screen.getByText('BRL total allowed')).toBeInTheDocument()
        expect(screen.queryByText('BRL left this month')).not.toBeInTheDocument()
    })
})

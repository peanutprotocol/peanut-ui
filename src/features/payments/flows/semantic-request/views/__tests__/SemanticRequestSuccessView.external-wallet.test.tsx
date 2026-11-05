// TASK-23856: the external-wallet success screen printed the typed amount
// whatever arrived. It reads the charge back; the booked figure stands in for
// dollars only on a dollar stablecoin.
import React from 'react'
import { renderWithIntl } from '@/test-utils/intl'

const mockFlow: Record<string, unknown> = {}
const mockSuccessView = jest.fn()
jest.mock('../../useSemanticRequestFlow', () => ({ useSemanticRequestFlow: () => mockFlow }))
jest.mock('@/hooks/usePointsCalculation', () => ({ usePointsCalculation: () => ({ pointsData: undefined }) }))
jest.mock('@/features/payments/shared/components/PaymentSuccessView', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => {
        mockSuccessView(props)
        return null
    },
}))

import { SemanticRequestSuccessView } from '../SemanticRequestSuccessView'

const setFlow = (overrides: Record<string, unknown>) =>
    Object.assign(mockFlow, {
        usdAmount: '58.51',
        recipient: { recipientType: 'USERNAME' },
        parsedUrl: null,
        attachment: {},
        payment: null,
        resetSemanticRequestFlow: jest.fn(),
        isExternalWalletPayment: true,
        ...overrides,
    })

beforeEach(() => jest.clearAllMocks())

test('an external-wallet payment shows what the USDC charge booked, with its status', () => {
    setFlow({
        charge: { tokenAmount: '58.51', tokenSymbol: 'USDC', settledAmount: '33', status: 'COMPLETED', payments: [] },
    })
    renderWithIntl(<SemanticRequestSuccessView />)

    expect(mockSuccessView).toHaveBeenCalledWith(
        expect.objectContaining({ usdAmount: '33', amount: '33', receiptStatus: 'completed' })
    )
})

test('a charge in another token keeps the dollar amount the flow priced', () => {
    setFlow({
        charge: { tokenAmount: '0.02', tokenSymbol: 'ETH', settledAmount: '0.01', status: 'COMPLETED', payments: [] },
    })
    renderWithIntl(<SemanticRequestSuccessView />)

    expect(mockSuccessView).toHaveBeenCalledWith(expect.objectContaining({ usdAmount: '58.51', amount: undefined }))
})

test('a Peanut payment keeps the default receipt status', () => {
    setFlow({
        isExternalWalletPayment: false,
        charge: { tokenAmount: '58.51', tokenSymbol: 'USDC', status: 'PENDING', payments: [] },
    })
    renderWithIntl(<SemanticRequestSuccessView />)

    expect(mockSuccessView).toHaveBeenCalledWith(
        expect.objectContaining({ usdAmount: '58.51', receiptStatus: undefined })
    )
})

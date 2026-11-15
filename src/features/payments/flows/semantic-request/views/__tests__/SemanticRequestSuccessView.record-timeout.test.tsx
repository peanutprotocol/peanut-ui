import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'

const mockFlow: Record<string, unknown> = {}
const mockSuccessView = jest.fn()
const mockPoints = jest.fn()
jest.mock('../../useSemanticRequestFlow', () => ({ useSemanticRequestFlow: () => mockFlow }))
jest.mock('@/hooks/usePointsCalculation', () => ({
    usePointsCalculation: (...args: unknown[]) => {
        mockPoints(...args)
        return { pointsData: undefined }
    },
}))
jest.mock('@/features/payments/shared/components/PaymentSuccessView', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => {
        mockSuccessView(props)
        return <div data-testid="payment-success" />
    },
}))
jest.mock('@/features/payments/shared/hooks/useFlowExit', () => ({ useFlowExit: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))

import { SemanticRequestSuccessView } from '../SemanticRequestSuccessView'

beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(mockFlow, {
        usdAmount: '10',
        recipient: { recipientType: 'USERNAME', identifier: 'alice' },
        parsedUrl: null,
        attachment: {},
        payment: null,
        resetSemanticRequestFlow: jest.fn(),
        isExternalWalletPayment: false,
        isPaymentStatusUnknown: true,
        isSuccess: false,
        charge: { uuid: 'charge-1', tokenAmount: '10', tokenSymbol: 'USDC', status: 'PENDING', payments: [] },
    })
})

it('reuses confirming for unknown Peanut recording without external-wallet fee semantics', () => {
    renderWithIntl(<SemanticRequestSuccessView />)
    expect(screen.getByText('Confirming payment')).toBeInTheDocument()
    expect(mockSuccessView).not.toHaveBeenCalled()
})

it('shows the normal Peanut receipt after authoritative completion', () => {
    mockFlow.isPaymentStatusUnknown = false
    mockFlow.isSuccess = true
    mockFlow.charge = { uuid: 'charge-1', tokenAmount: '10', tokenSymbol: 'USDC', status: 'COMPLETED', payments: [] }
    renderWithIntl(<SemanticRequestSuccessView />)
    expect(mockSuccessView).toHaveBeenCalledWith(
        expect.objectContaining({ usdAmount: '10', isExternalWalletPayment: false })
    )
    expect(screen.queryByText('Confirming payment')).toBeNull()
})

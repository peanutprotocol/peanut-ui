import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'

const mockFlow: Record<string, unknown> = {}
const mockSuccessView = jest.fn()
const mockPoints = jest.fn()
jest.mock('../../useDirectSendFlow', () => ({ useDirectSendFlow: () => mockFlow }))
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
jest.mock('@/features/payments/shared/components/PaymentConfirmingView', () => ({
    __esModule: true,
    default: () => <div data-testid="payment-confirming">Confirming payment</div>,
    PaymentConfirmingView: () => <div data-testid="payment-confirming">Confirming payment</div>,
}))
jest.mock('@/features/payments/shared/hooks/useFlowExit', () => ({ useFlowExit: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))

import { SendSuccessView } from '../SendSuccessView'

beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(mockFlow, {
        usdAmount: '10',
        recipient: { username: 'alice', address: '0x1111111111111111111111111111111111111111', userId: 'peer-user' },
        attachment: {},
        charge: { uuid: 'charge-1', tokenAmount: '10', tokenSymbol: 'USDC', tokenDecimals: 6, status: 'PROCESSING' },
        payment: null,
        resetSendFlow: jest.fn(),
        isSuccess: false,
    })
})

it('shows confirming for an unresolved direct-send outcome without claiming success', () => {
    renderWithIntl(<SendSuccessView />)
    expect(screen.getByTestId('payment-confirming')).toBeInTheDocument()
    expect(mockSuccessView).not.toHaveBeenCalled()
})

it('shows the success receipt when the flow confirms success', () => {
    mockFlow.isSuccess = true
    renderWithIntl(<SendSuccessView />)
    expect(screen.getByTestId('payment-success')).toBeInTheDocument()
    expect(screen.queryByTestId('payment-confirming')).toBeNull()
})

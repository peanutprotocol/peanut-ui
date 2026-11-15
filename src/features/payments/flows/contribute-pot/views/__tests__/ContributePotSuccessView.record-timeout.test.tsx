import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'

const mockFlow: Record<string, unknown> = {}
const mockSuccessView = jest.fn()
jest.mock('../../useContributePotFlow', () => ({ useContributePotFlow: () => mockFlow }))
const mockPoints = jest.fn()
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

import { ContributePotSuccessView } from '../ContributePotSuccessView'

const charge = (overrides: Record<string, unknown>) => ({
    uuid: 'charge-1',
    tokenAmount: '58.51',
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    payments: [],
    requestLink: { uuid: 'request-1' },
    ...overrides,
})

const setFlow = (overrides: Record<string, unknown>) =>
    Object.assign(mockFlow, {
        usdAmount: '58.51',
        recipient: { username: 'ana', userId: 'ana-id' },
        attachment: {},
        payment: null,
        resetContributePotFlow: jest.fn(),
        isExternalWalletPayment: true,
        ...overrides,
    })

beforeEach(() => jest.clearAllMocks())

it('reuses confirming for an unknown Peanut recording outcome without external-wallet fee semantics', () => {
    setFlow({
        isExternalWalletPayment: false,
        isPaymentStatusUnknown: true,
        isSuccess: false,
        charge: charge({ status: 'PENDING', settledAmount: null }),
    })
    renderWithIntl(<ContributePotSuccessView />)
    expect(screen.getByText('Confirming payment')).toBeInTheDocument()
    expect(mockSuccessView).not.toHaveBeenCalled()
    expect(mockPoints).toHaveBeenCalledWith(expect.anything(), '58.51', false, undefined, 'ana-id')
})

it('keeps normal Peanut success when recording is confirmed', () => {
    setFlow({
        isExternalWalletPayment: false,
        isPaymentStatusUnknown: false,
        isSuccess: true,
        charge: charge({ status: 'COMPLETED', settledAmount: '58.51' }),
    })
    renderWithIntl(<ContributePotSuccessView />)
    expect(mockSuccessView).toHaveBeenCalled()
    expect(screen.queryByText('Confirming payment')).toBeNull()
})

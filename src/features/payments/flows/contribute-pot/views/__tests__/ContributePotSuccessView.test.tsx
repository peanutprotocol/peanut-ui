// TASK-23856: an external-wallet payer was told "Sent $58.51" when 33 USDC
// arrived. The success screen states what the charge booked. A short payment
// never reaches it: the flow keeps the deposit card (ExternalWalletPaymentView).
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

// The read-back gave up while the API had not booked the payment (or the
// deposit was under the bridge minimum and never will be): nothing is claimed.
test.each(['PENDING', 'PROCESSING'])('a charge still %s after the read-back shows the confirming screen', (status) => {
    setFlow({ charge: charge({ status, settledAmount: null }) })
    renderWithIntl(<ContributePotSuccessView />)

    expect(screen.getByText('Confirming payment')).toBeInTheDocument()
    expect(screen.getByText(/It can take a few minutes, and it will show in Activity\./)).toBeInTheDocument()
    expect(screen.getByText(/If it does not arrive, contact support\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    expect(screen.queryByText(/Sent/)).toBeNull()
    expect(mockSuccessView).not.toHaveBeenCalled()
    // no points estimate for a payment that has not landed
    expect(mockPoints).toHaveBeenCalledWith(expect.anything(), '58.51', false, undefined, 'ana-id')
})

// An API from before api#1907 sends no charge status: the payment cannot be
// told booked, so the screen claims no amount (it used to say "Sent $58.51").
test('an external-wallet charge without a status shows the confirming screen, not an amount', () => {
    setFlow({ charge: charge({}) })
    renderWithIntl(<ContributePotSuccessView />)

    expect(screen.getByText('Confirming payment')).toBeInTheDocument()
    expect(screen.queryByText(/Sent/)).toBeNull()
    expect(mockSuccessView).not.toHaveBeenCalled()
})

test('a full deposit shows the booked amount and the charge status on the receipt', () => {
    setFlow({ charge: charge({ status: 'COMPLETED', settledAmount: '58.51', partialPayment: false }) })
    renderWithIntl(<ContributePotSuccessView />)

    expect(mockSuccessView).toHaveBeenCalledWith(
        expect.objectContaining({ usdAmount: '58.51', amount: '58.51', receiptStatus: 'completed' })
    )
    expect(mockPoints).toHaveBeenCalledWith(expect.anything(), '58.51', true, undefined, 'ana-id')
})

test('a Peanut payment keeps the default receipt status: its charge was read before the payment', () => {
    setFlow({ isExternalWalletPayment: false, charge: charge({ status: 'PENDING', settledAmount: null }) })
    renderWithIntl(<ContributePotSuccessView />)

    expect(mockSuccessView).toHaveBeenCalledWith(
        expect.objectContaining({ usdAmount: '58.51', receiptStatus: undefined })
    )
})

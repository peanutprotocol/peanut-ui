/**
 * CancelDepositActions — cancel buttons for pending bank-deposit flows.
 *
 * Regression tests for the instant-cancel bug: the cancel button fired
 * cancelOnramp straight from onClick with no confirmation, sitting right next
 * to the support link — a real user cancelled a funded deposit while trying to
 * report a problem, making the wire unmatchable. Every cancel must go through
 * an explicit confirmation first. Nested primitives are stubbed so only this
 * component's own logic is under test.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockCancelOnramp = jest.fn()
jest.mock('@/app/actions/onramp', () => ({
    cancelOnramp: (...args: unknown[]) => mockCancelOnramp(...args),
}))
const mockMantecaCancel = jest.fn()
jest.mock('@/services/manteca', () => ({
    mantecaApi: { cancelDeposit: (...args: unknown[]) => mockMantecaCancel(...args) },
}))
jest.mock('@/services/charges', () => ({
    chargesApi: { cancel: jest.fn() },
}))
const mockInvalidateQueries = jest.fn()
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/components/TransactionDetails/transaction-predicates', () => ({
    isMantecaOnrampEntry: () => false,
    isRequestEntry: () => false,
}))
jest.mock('@/hooks/useTransactionHistory', () => ({
    EHistoryUserRole: { SENDER: 'SENDER' },
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        onClick,
        disabled,
    }: {
        children: React.ReactNode
        onClick?: () => void
        disabled?: boolean
    }) => (
        <button onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}))
jest.mock('@/components/Global/ErrorAlert', () => ({
    __esModule: true,
    default: ({ description }: { description: string }) => <div data-testid="error">{description}</div>,
}))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => <span /> }))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({
        visible,
        title,
        ctas,
        onClose,
    }: {
        visible: boolean
        title: React.ReactNode
        ctas?: Array<{ text: string; onClick?: () => void }>
        onClose: () => void
    }) =>
        visible ? (
            <div data-testid="confirm-modal">
                <p>{title}</p>
                {ctas?.map((cta) => (
                    <button key={cta.text} onClick={cta.onClick}>
                        {cta.text}
                    </button>
                ))}
                <button onClick={onClose}>Dismiss</button>
            </div>
        ) : null,
}))

// import must come after jest.mock
import { CancelDepositActions } from '../CancelDepositActions'

const pendingBridgeOnramp = {
    id: 'tx-1',
    direction: 'bank_deposit',
    status: 'pending',
    extraDataForDrawer: { depositInstructions: { deposit_message: 'BRGTESTREF1234567890' } },
} as unknown as import('@/components/TransactionDetails/transactionTransformer').TransactionDetails

const renderCancel = () =>
    render(
        <CancelDepositActions
            transaction={pendingBridgeOnramp}
            isPendingBankRequest={false}
            isLoading={false}
            setIsLoading={jest.fn()}
            onClose={jest.fn()}
        />
    )

beforeEach(() => {
    mockCancelOnramp.mockReset().mockResolvedValue({})
    mockMantecaCancel.mockReset()
    mockInvalidateQueries.mockReset().mockResolvedValue(undefined)
})

describe('CancelDepositActions confirmation gate', () => {
    it('does NOT cancel on the first click — it asks for confirmation instead', () => {
        renderCancel()

        expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('Cancel deposit'))

        expect(mockCancelOnramp).not.toHaveBeenCalled()
        expect(screen.getByTestId('confirm-modal')).toBeInTheDocument()
        expect(screen.getByText('Cancel this deposit?')).toBeInTheDocument()
    })

    it('cancels only after the user confirms', async () => {
        renderCancel()

        fireEvent.click(screen.getByText('Cancel deposit'))
        fireEvent.click(screen.getByText('Yes, cancel deposit'))

        await waitFor(() => expect(mockCancelOnramp).toHaveBeenCalledWith('tx-1'))
    })

    it('dismissing the confirmation leaves the deposit untouched', () => {
        renderCancel()

        fireEvent.click(screen.getByText('Cancel deposit'))
        fireEvent.click(screen.getByText('Dismiss'))

        expect(mockCancelOnramp).not.toHaveBeenCalled()
        expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument()
    })
})

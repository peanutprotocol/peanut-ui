import React from 'react'
import { render, screen } from '@testing-library/react'
import { PublicReceiptPage } from '../PublicReceiptPage'
import { useAuth } from '@/context/authContext'

jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: () => <div data-testid="receipt-nav">receipt navigation</div>,
}))
jest.mock('@/components/TransactionDetails/TransactionDetailsReceipt', () => ({
    TransactionDetailsReceipt: ({ showPublicIssuer }: { showPublicIssuer: boolean }) => (
        <div data-testid="receipt" data-show-public-issuer={showPublicIssuer} />
    ),
}))
jest.mock('@/components/TransactionDetails/ReceiptUnavailable', () => ({
    ReceiptUnavailable: () => <div>receipt unavailable</div>,
}))

const mockedUseAuth = jest.mocked(useAuth)
const transaction = { id: 'receipt-id' } as never

describe('PublicReceiptPage', () => {
    test('shows the issuer block and no navigation for a signed-out visitor', () => {
        mockedUseAuth.mockReturnValue({ user: null, isFetchingUser: false } as ReturnType<typeof useAuth>)

        render(<PublicReceiptPage transaction={transaction} />)

        expect(screen.queryByTestId('receipt-nav')).not.toBeInTheDocument()
        expect(screen.getByTestId('receipt')).toHaveAttribute('data-show-public-issuer', 'true')
    })

    test('shows navigation and no issuer block for a signed-in visitor', () => {
        mockedUseAuth.mockReturnValue({
            user: { user: { userId: 'user-id' } },
            isFetchingUser: false,
        } as ReturnType<typeof useAuth>)

        render(<PublicReceiptPage transaction={transaction} />)

        expect(screen.getByTestId('receipt-nav')).toBeInTheDocument()
        expect(screen.getByTestId('receipt')).toHaveAttribute('data-show-public-issuer', 'false')
    })

    test('removes signed-in chrome after the live auth session expires', () => {
        mockedUseAuth.mockReturnValue({
            user: { user: { userId: 'user-id' } },
            isFetchingUser: false,
        } as ReturnType<typeof useAuth>)

        const { rerender } = render(<PublicReceiptPage transaction={transaction} />)

        expect(screen.getByTestId('receipt-nav')).toBeInTheDocument()
        expect(screen.getByTestId('receipt')).toHaveAttribute('data-show-public-issuer', 'false')

        mockedUseAuth.mockReturnValue({ user: null, isFetchingUser: false } as ReturnType<typeof useAuth>)
        rerender(<PublicReceiptPage transaction={transaction} />)

        expect(screen.queryByTestId('receipt-nav')).not.toBeInTheDocument()
        expect(screen.getByTestId('receipt')).toHaveAttribute('data-show-public-issuer', 'true')
    })

    test('waits for auth before rendering either chrome variant', () => {
        mockedUseAuth.mockReturnValue({ user: null, isFetchingUser: true } as ReturnType<typeof useAuth>)

        render(<PublicReceiptPage transaction={transaction} />)

        expect(screen.queryByTestId('receipt-nav')).not.toBeInTheDocument()
        expect(screen.getByTestId('receipt')).toHaveAttribute('data-show-public-issuer', 'false')
    })
})

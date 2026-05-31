import { fireEvent, render, screen } from '@testing-library/react'
import { type ReactNode } from 'react'
import { KycActionRequired } from '../KycActionRequired'
import { KycFailed } from '../KycFailed'

// Regression guard for the Bridge KYC gate bug: onClick handlers must wrap
// their callback (onClick={() => fn()}) so a React synthetic event never leaks
// in as the first argument. The capabilities rehaul replaced KycNotStarted +
// KycRequiresDocuments with KycActionRequired, so this now covers the two
// surviving rejection/resubmit states.

jest.mock('../../KYCStatusDrawerItem', () => ({
    KYCStatusDrawerItem: () => <div data-testid="kyc-status-drawer-item" />,
}))

jest.mock('../../RejectLabelsList', () => ({
    RejectLabelsList: () => <div data-testid="reject-labels-list" />,
}))

jest.mock('@/components/Payment/PaymentInfoRow', () => ({
    PaymentInfoRow: () => <div data-testid="payment-info-row" />,
}))

jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

describe('KycActionRequired', () => {
    it('does not pass the click event to onResume', () => {
        const onResume = jest.fn()
        render(<KycActionRequired onResume={onResume} />)

        fireEvent.click(screen.getByText('Re-submit verification'))

        expect(onResume).toHaveBeenCalledTimes(1)
        expect(onResume).toHaveBeenCalledWith()
    })
})

describe('KycFailed', () => {
    it('does not pass the click event to onRetry', () => {
        const onRetry = jest.fn()
        render(<KycFailed onRetry={onRetry} />)

        fireEvent.click(screen.getByText('Retry verification'))

        expect(onRetry).toHaveBeenCalledTimes(1)
        expect(onRetry).toHaveBeenCalledWith()
    })
})

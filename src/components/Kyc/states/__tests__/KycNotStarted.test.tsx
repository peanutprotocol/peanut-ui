import { fireEvent, render, screen } from '@testing-library/react'
import { type ReactNode } from 'react'
import { KycActionRequired } from '../KycActionRequired'
import { KycFailed } from '../KycFailed'
import { KycNotStarted } from '../KycNotStarted'
import { KycRequiresDocuments } from '../KycRequiresDocuments'

jest.mock('use-haptic', () => ({
    useHaptic: () => ({ triggerHaptic: jest.fn() }),
}))

jest.mock('@/hooks/useLongPress', () => ({
    useLongPress: () => ({
        isLongPressed: false,
        pressProgress: 0,
        handlers: {},
    }),
}))

jest.mock('../../KYCStatusDrawerItem', () => ({
    KYCStatusDrawerItem: () => <div data-testid="kyc-status-drawer-item" />,
}))

jest.mock('../../RejectLabelsList', () => ({
    RejectLabelsList: () => <div data-testid="reject-labels-list" />,
}))

jest.mock('../../KycFailedContent', () => ({
    KycFailedContent: () => <div data-testid="kyc-failed-content" />,
}))

jest.mock('../../CountryRegionRow', () => ({
    CountryRegionRow: () => <div data-testid="country-region-row" />,
}))

jest.mock('@/components/Payment/PaymentInfoRow', () => ({
    PaymentInfoRow: () => <div data-testid="payment-info-row" />,
}))

jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/Global/InfoCard', () => ({
    __esModule: true,
    default: ({ description }: { description: string }) => <div>{description}</div>,
}))

jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }),
}))

describe('KycNotStarted', () => {
    it('does not pass the click event to onResume', () => {
        const onResume = jest.fn()
        render(<KycNotStarted onResume={onResume} />)

        fireEvent.click(screen.getByText('Continue verification'))

        expect(onResume).toHaveBeenCalledTimes(1)
        expect(onResume).toHaveBeenCalledWith()
    })

    it('does not pass the click event to action-required resume', () => {
        const onResume = jest.fn()
        render(<KycActionRequired onResume={onResume} />)

        fireEvent.click(screen.getByText('Re-submit verification'))

        expect(onResume).toHaveBeenCalledTimes(1)
        expect(onResume).toHaveBeenCalledWith()
    })

    it('does not pass the click event to failed retry', () => {
        const onRetry = jest.fn()
        render(<KycFailed onRetry={onRetry} isSumsub={false} />)

        fireEvent.click(screen.getByText('Retry verification'))

        expect(onRetry).toHaveBeenCalledTimes(1)
        expect(onRetry).toHaveBeenCalledWith()
    })

    it('does not pass the click event to document submission', () => {
        const onSubmitDocuments = jest.fn()
        render(<KycRequiresDocuments requirements={[]} onSubmitDocuments={onSubmitDocuments} />)

        fireEvent.click(screen.getByText('Submit documents'))

        expect(onSubmitDocuments).toHaveBeenCalledTimes(1)
        expect(onSubmitDocuments).toHaveBeenCalledWith()
    })
})

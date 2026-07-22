import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { type ReactNode } from 'react'
import { KycActionRequired } from '../KycActionRequired'
import { KycFailed } from '../KycFailed'

const IntlWrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        {children}
    </NextIntlClientProvider>
)
const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

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

describe('KYC state cards', () => {
    it('does not pass the click event to action-required resume', () => {
        const onResume = jest.fn()
        render(<KycActionRequired onResume={onResume} />)

        fireEvent.click(screen.getByText('Re-submit verification'))

        expect(onResume).toHaveBeenCalledTimes(1)
        expect(onResume).toHaveBeenCalledWith()
    })

    it('shows per-label reject copy (not the generic actionMessage) when reject labels are present', () => {
        // DUPLICATE_EMAIL regression: the backend always sends a generic
        // "resubmit your documents" actionMessage for action_required, which used
        // to mask the specific "Email already in use" reject-label copy.
        render(
            <KycActionRequired
                onResume={jest.fn()}
                actionMessage="We need a bit more to verify your identity. Please resubmit your documents."
                rejectLabels={['DUPLICATE_EMAIL']}
            />
        )

        expect(screen.getByTestId('reject-labels-list')).toBeInTheDocument()
        expect(screen.queryByText(/resubmit your documents/i)).not.toBeInTheDocument()
    })

    it('falls back to the generic actionMessage when there are no reject labels', () => {
        render(
            <KycActionRequired onResume={jest.fn()} actionMessage="Please resubmit your documents." rejectLabels={[]} />
        )

        expect(screen.getByText('Please resubmit your documents.')).toBeInTheDocument()
        expect(screen.queryByTestId('reject-labels-list')).not.toBeInTheDocument()
    })

    it('does not pass the click event to failed retry', () => {
        const onRetry = jest.fn()
        render(<KycFailed onRetry={onRetry} />)

        fireEvent.click(screen.getByText('Retry verification'))

        expect(onRetry).toHaveBeenCalledTimes(1)
        expect(onRetry).toHaveBeenCalledWith()
    })
})

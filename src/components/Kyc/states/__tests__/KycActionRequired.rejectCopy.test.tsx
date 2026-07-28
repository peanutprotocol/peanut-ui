import { render as rtlRender, screen } from '@testing-library/react'
import { type ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { KycActionRequired } from '../KycActionRequired'

// Integration-level companion to KycStates.test.tsx: that suite mocks
// RejectLabelsList to assert branch selection. Here we render the REAL
// RejectLabelsList + reject-label copy map so a regression in the
// DUPLICATE_EMAIL → "Email already in use" mapping (the whole point of the
// precedence fix) actually fails a test instead of shipping silently.

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
    useLongPress: () => ({ isLongPressed: false, pressProgress: 0, handlers: {} }),
}))

jest.mock('../../KYCStatusDrawerItem', () => ({
    KYCStatusDrawerItem: () => <div data-testid="kyc-status-drawer-item" />,
}))

// InfoCard is the leaf both branches render through; surface its text so we can
// assert the actual copy. RejectLabelsList is intentionally NOT mocked.
jest.mock('@/components/Global/InfoCard', () => ({
    __esModule: true,
    default: ({ title, description }: { title?: string; description?: string }) => (
        <>
            {title ? <div>{title}</div> : null}
            {description ? <div>{description}</div> : null}
        </>
    ),
}))

describe('KycActionRequired — real reject-label copy', () => {
    it('renders the DUPLICATE_EMAIL guidance, not the generic resubmit message', () => {
        render(
            <KycActionRequired
                onResume={jest.fn()}
                actionMessage="We need a bit more to verify your identity. Please resubmit your documents."
                rejectLabels={['DUPLICATE_EMAIL']}
            />
        )

        expect(screen.getByText(/already linked to another Peanut account/i)).toBeInTheDocument()
        expect(screen.getByText(/sign in to that account/i)).toBeInTheDocument()
        expect(screen.queryByText(/resubmit your documents/i)).not.toBeInTheDocument()
    })
})

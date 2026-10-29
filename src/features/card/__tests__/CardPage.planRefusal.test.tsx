/**
 * POST /rain/cards answers 403 provider-not-in-plan when the send gate
 * refuses Rain for this user's plan. The card page shows the reason and the
 * step the reason calls for, never the backend's English error line.
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import { CardPage } from '../CardPage'

const handleRestartIdentity = jest.fn()
const setIsSupportModalOpen = jest.fn()
const setPlanRefusal = jest.fn()
let mockFlow: Record<string, unknown> = {}
const kycFlow = (overrides: Record<string, unknown> = {}) => ({
    handleRestartIdentity,
    error: null,
    isTerminalError: false,
    ...overrides,
})

jest.mock('../useCardFlow', () => ({ useCardFlow: () => mockFlow }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({ SumsubKycWrapper: () => null }))
jest.mock('../components/CardAcquisitionScreen', () => ({
    CardAcquisitionScreen: ({ applyError }: { applyError?: string | null }) => (
        <div>acquisition:{applyError ?? 'no-error'}</div>
    ),
    CardMilestoneScreen: () => null,
}))
jest.mock('@/components/Card/YourCardScreen', () => ({ __esModule: true, default: () => null }))
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => null,
    useAuth: () => ({ user: { accounts: [] }, fetchUser: jest.fn() }),
}))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => <img alt={String(props.alt ?? '')} />,
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    usePathname: () => '/card',
}))

const flow = (overrides: Record<string, unknown>) => ({
    user: { user: { userId: 'u1' } },
    state: 'add-card',
    cardInfo: { isEligible: true },
    overview: { status: { hasApplication: false } },
    applyError: null,
    setApplyError: jest.fn(),
    planRefusal: null,
    setPlanRefusal,
    kycFlow: kycFlow(),
    poaToken: null,
    sumsubToken: null,
    setIsSupportModalOpen,
    onBack: jest.fn(),
    ...overrides,
})

const renderPage = () =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <IntlWrapper>
                <CardPage />
            </IntlWrapper>
        </QueryClientProvider>
    )

beforeEach(() => jest.clearAllMocks())

describe('CardPage — a card the plan does not send to Rain', () => {
    it.each(['pending', 'setting_up'])('activation %s uses the existing feature setup screen', (state) => {
        mockFlow = flow({
            activation: {
                allowed: false,
                isLoading: false,
                result: { kind: 'report', report: { state } },
                activate: jest.fn(),
            },
        })
        renderPage()
        expect(screen.getByText("We're setting things up")).toBeInTheDocument()
        expect(screen.queryByText(/acquisition:/)).not.toBeInTheDocument()
    })
    it('shows the identity wait after applying, with no new apply action', () => {
        mockFlow = flow({ pendingApplication: 'pending-identity' })
        renderPage()
        expect(screen.getByText('We’ll set up your card once your ID check is done.')).toBeInTheDocument()
        expect(screen.queryByText(/acquisition:/)).not.toBeInTheDocument()
    })

    it('keeps a pending application without a provider user on the waiting screen', () => {
        mockFlow = flow({ pendingApplication: 'pending' })
        renderPage()
        expect(screen.queryByText(/acquisition:/)).not.toBeInTheDocument()
        expect(screen.getByText('Setting up card…')).toBeInTheDocument()
    })
    it('asks for another document and restarts identity from the status screen', () => {
        mockFlow = flow({ planRefusal: 'identity_document_insufficient' })
        renderPage()

        expect(
            screen.getByText(
                "The document you verified with can't be used for this account. Verify again with a different ID document."
            )
        ).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Upload identity documents' }))
        expect(handleRestartIdentity).toHaveBeenCalled()
    })

    it('sends a need the app cannot collect to support, with no self-serve button', () => {
        mockFlow = flow({ planRefusal: 'requirements_uncollectable' })
        renderPage()

        expect(
            screen.getByText(
                "Our payment partner needs something we can't collect in the app. Message support and we'll finish setting this up with you."
            )
        ).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Upload identity documents' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('Contact support'))
        expect(setIsSupportModalOpen).toHaveBeenCalledWith(true)
        expect(handleRestartIdentity).not.toHaveBeenCalled()
    })

    it('shows a supplement that only support can finish on the same screen', () => {
        mockFlow = flow({
            kycFlow: kycFlow({ error: 'Message support and we will finish this.', isTerminalError: true }),
        })
        renderPage()

        expect(screen.getByText('Message support and we will finish this.')).toBeInTheDocument()
        fireEvent.click(screen.getByText('Contact support'))
        expect(setIsSupportModalOpen).toHaveBeenCalledWith(true)
    })

    it('shows a supplement that failed to start on the entry screen', () => {
        mockFlow = flow({ kycFlow: kycFlow({ error: 'Could not start verification. Please try again.' }) })
        renderPage()

        expect(screen.getByText('acquisition:Could not start verification. Please try again.')).toBeInTheDocument()
    })
})

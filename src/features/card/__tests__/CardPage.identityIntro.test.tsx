/**
 * A legacy applicant's first ID check runs in the card level's Sumsub. It opens
 * behind /verify's intro, as every other start does (Slava, 2026-11-03); a
 * verified user's token (the card questions, a missing selfie) opens Sumsub at once.
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import { CardPage } from '../CardPage'

const handleSumsubClose = jest.fn()
let mockFlow: Record<string, unknown> = {}

jest.mock('../useCardFlow', () => ({ useCardFlow: () => mockFlow }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({
    SumsubKycWrapper: ({ visible, accessToken }: { visible: boolean; accessToken: string | null }) =>
        visible ? <div data-testid="sumsub-sdk">{accessToken}</div> : null,
}))
jest.mock('../components/CardAcquisitionScreen', () => ({
    CardAcquisitionScreen: () => <div>acquisition</div>,
    CardMilestoneScreen: () => null,
}))
jest.mock('@/components/Card/YourCardScreen', () => ({ __esModule: true, default: () => null }))
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => null,
    useAuth: () => ({ user: null, fetchUser: jest.fn() }),
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

const flow = (identityVerification: Record<string, unknown> | undefined) => ({
    user: { user: { userId: 'u1' }, ...(identityVerification ? { identityVerification } : {}) },
    state: 'add-card',
    cardInfo: { isEligible: true },
    overview: { status: { hasApplication: false } },
    applyError: null,
    setApplyError: jest.fn(),
    planRefusal: null,
    setPlanRefusal: jest.fn(),
    kycFlow: { handleRestartIdentity: jest.fn(), error: null, isTerminalError: false },
    poaToken: null,
    informationSession: null,
    sumsubToken: 'card-level-token',
    handleSumsubClose,
    handleSumsubComplete: jest.fn(),
    handleSumsubRefreshToken: jest.fn(),
    setIsSupportModalOpen: jest.fn(),
    onBack: jest.fn(),
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

describe('CardPage — the first ID check opens behind the intro', () => {
    it('shows the steps and the card provider before Sumsub, and Continue opens it', () => {
        mockFlow = flow({ status: 'not_started' })
        renderPage()

        expect(screen.getByTestId('identity-check-intro')).toBeInTheDocument()
        expect(screen.getByText('Card provider')).toBeInTheDocument()
        expect(screen.getByText('Answer a few questions')).toBeInTheDocument()
        expect(screen.queryByTestId('sumsub-sdk')).not.toBeInTheDocument()

        fireEvent.click(screen.getByTestId('verify-steps-continue'))
        expect(screen.queryByTestId('identity-check-intro')).not.toBeInTheDocument()
        expect(screen.getByTestId('sumsub-sdk')).toHaveTextContent('card-level-token')
    })

    it('goes back the way closing Sumsub does', () => {
        mockFlow = flow({ status: 'not_started' })
        renderPage()

        fireEvent.click(screen.getByTestId('verify-back'))
        expect(handleSumsubClose).toHaveBeenCalledTimes(1)
    })

    it("opens a verified user's card questions in Sumsub at once", () => {
        mockFlow = flow({ status: 'verified' })
        renderPage()

        expect(screen.queryByTestId('identity-check-intro')).not.toBeInTheDocument()
        expect(screen.getByTestId('sumsub-sdk')).toBeInTheDocument()
    })

    it('opens Sumsub at once when the API sends no identity status', () => {
        mockFlow = flow(undefined)
        renderPage()

        expect(screen.queryByTestId('identity-check-intro')).not.toBeInTheDocument()
        expect(screen.getByTestId('sumsub-sdk')).toBeInTheDocument()
    })
})

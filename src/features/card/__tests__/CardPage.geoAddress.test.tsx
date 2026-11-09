/**
 * POST /rain/cards answers 403 provider-not-in-plan when the send gate
 * refuses Rain for this user's plan. The card page shows the reason and the
 * step the reason calls for, never the backend's English error line.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import { CardPage } from '../CardPage'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'

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
    useAuth: () => ({
        user: {
            accounts: [],
            capabilities: withFeatureReport({ rails: [], nextActions: [] }, { identity: { status: 'verified' } }),
        },
        fetchUser: jest.fn(),
    }),
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

it('keeps a computed geographic refusal ahead of a cached address requirement', () => {
    const apply = jest.fn()
    mockFlow = flow({
        state: 'geo-blocked',
        cardInfo: { isEligible: false, geoProhibited: true },
        residenceAddressStep: 'required',
        addressStarting: false,
        geoBlocked: false,
        pendingResidenceBlocked: false,
        handleApply: apply,
        refreshResidenceAddress: jest.fn(),
    })
    renderPage()
    expect(screen.queryByRole('button', { name: 'Add address' })).not.toBeInTheDocument()
    expect(screen.getByText("Cards aren't available in this region yet")).toBeInTheDocument()
    expect(apply).not.toHaveBeenCalled()
})

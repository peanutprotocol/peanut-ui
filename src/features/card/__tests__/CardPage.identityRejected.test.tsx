/**
 * A finally rejected identity opens the card tab on its reason and the way on,
 * as /verify shows it, never the application's "We need more information".
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
const mockReplace = jest.fn()
let mockIdentity: Record<string, unknown> | undefined
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
        user: { user: { userId: 'u1' }, accounts: [], identityVerification: mockIdentity },
        fetchUser: jest.fn(),
        logoutUser: jest.fn(),
    }),
}))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => <img alt={String(props.alt ?? '')} />,
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
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

it('a Sumsub duplicate on the card tab shows the duplicate reason with support first', () => {
    mockIdentity = {
        status: 'failed',
        canRetry: false,
        rejectLabels: ['DUPLICATE'],
        reason: { code: 'duplicate_account', userMessage: '' },
    }
    mockFlow = flow({
        planRefusal: 'duplicate_account',
        user: { user: { userId: 'u1' }, identityVerification: mockIdentity },
    })
    renderPage()
    expect(screen.getByText(/already linked to another Peanut account/)).toBeInTheDocument()
    expect(screen.queryByText('We need more information')).toBeNull()
    const names = screen.getAllByRole('button').map((b) => b.textContent)
    expect(names.indexOf('Contact support')).toBeLessThan(names.indexOf('Log in to another account'))
    fireEvent.click(screen.getByRole('button', { name: 'Go to Home' }))
    expect(mockReplace).toHaveBeenCalledWith('/home')
})

it('a cardholder is never sent to the rejection screen', () => {
    mockIdentity = { status: 'failed', canRetry: false, rejectLabels: ['DUPLICATE'] }
    mockFlow = flow({
        state: 'active',
        overview: { status: { hasApplication: true }, cards: [{ id: 'c1', status: 'ACTIVE', last4: '0420' }] },
        user: { user: { userId: 'u1' }, identityVerification: mockIdentity },
    })
    renderPage()
    expect(screen.queryByText(/already linked to another Peanut account/)).toBeNull()
})

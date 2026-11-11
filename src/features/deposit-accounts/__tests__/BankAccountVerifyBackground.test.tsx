import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import messages from '@/i18n/app/messages/en.json'
import { DepositAccountsFlow } from '../components/DepositAccountsFlow'
import { corridorRecord, DEPOSIT_RAIL_ORDER, emptyCorridorRecord } from '../rails'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'

const mockClaim = jest.fn()
const mockVerify = jest.fn()
const mockResolve = jest.fn()
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/add-money',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: {
            user: { userId: 'test-user', fullName: 'Demo User' },
            capabilities: withFeatureReport({ rails: [], nextActions: [] }, { identity: { status: 'verified' } }),
        },
    }),
    useOptionalAuth: () => null,
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ openSupportWithMessage: jest.fn() }),
    useModalsContextOptional: () => undefined,
}))
jest.mock('../useDepositAccountsEnabled', () => ({ useDepositAccountsEnabled: () => true }))
jest.mock('../useResidenceIso2s', () => ({ useResidenceIso2s: () => [] }))
jest.mock('../useEndorsementReview', () => ({ useEndorsementReview: () => undefined }))
jest.mock('../useDepositGateRemediation', () => ({
    useDepositGateRemediation: () => ({ resolveGate: mockResolve, verifyCorridor: mockVerify, modals: null }),
}))
jest.mock('../useDepositAccounts', () => ({
    useDepositAccounts: () => ({
        corridors: DEPOSIT_RAIL_ORDER,
        accounts: emptyCorridorRecord(),
        claimable: emptyCorridorRecord(),
        unavailable: emptyCorridorRecord(),
        slotsHeld: 0,
        gates: corridorRecord(() => ({ kind: 'ready' })),
        isLoading: false,
        isError: false,
        claim: mockClaim,
        refetch: jest.fn(),
    }),
}))
jest.mock('@/hooks/useBankRows', () => ({ useBankRows: () => ({ rows: [] }) }))
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))
jest.mock('@/features/pix/usePixPayBlock', () => ({ usePixPayBlock: () => null }))
jest.mock('@/components/Common/CountryList', () => ({
    CountryList: ({ searchTerm }: { searchTerm: string }) => (
        <div data-testid="country-list" data-search={searchTerm}>
            Country discovery
        </div>
    ),
}))
jest.mock('../useDepositCountryRouting', () => ({
    useDepositCountryRouting: () => ({ openCountry: jest.fn(), isCountrySupported: () => true }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const show = (searchParams: string) => {
    const onExit = jest.fn()
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <NuqsTestingAdapter searchParams={searchParams}>
                <DepositAccountsFlow
                    corridors={DEPOSIT_RAIL_ORDER}
                    accounts={emptyCorridorRecord()}
                    gates={corridorRecord(() => ({ kind: 'needs-identity' }))}
                    isLoading={false}
                    userName="Demo User"
                    onExit={onExit}
                    onClaim={mockClaim}
                    onResolveGate={mockResolve}
                    onRetry={jest.fn()}
                    onContactSupport={jest.fn()}
                />
            </NuqsTestingAdapter>
        </NextIntlClientProvider>
    )
    return onExit
}

beforeEach(() => jest.clearAllMocks())

describe('bank account verification background', () => {
    it.each(['SEPA_EU', 'ACH_US'])(
        'keeps the bank account list behind %s and exits without starting work',
        async (corridor) => {
            const onExit = show(`?method=bank&step=claim&corridor=${corridor}&returnTo=%2Fprofile%2Faccounts`)
            expect(screen.getByRole('dialog')).toBeInTheDocument()
            expect(screen.queryByPlaceholderText('Search currency or country')).not.toBeInTheDocument()
            expect(screen.getByText('Bank account')).toBeInTheDocument()
            expect(screen.queryByTestId('other-countries-toggle')).not.toBeInTheDocument()
            expect(screen.queryByText(/crypto/i)).not.toBeInTheDocument()
            expect(mockClaim).not.toHaveBeenCalled()
            expect(mockVerify).not.toHaveBeenCalled()
            expect(mockResolve).not.toHaveBeenCalled()
            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
            expect(onExit).toHaveBeenCalled()
        }
    )

    it.each(['', '&returnTo=%2Fcard', '&returnTo=https%3A%2F%2Fevil.example'])(
        'uses the normal add money presentation for other origins: %s',
        async (origin) => {
            show(`?method=bank&step=claim&corridor=SEPA_EU${origin}`)
            expect(screen.getByRole('dialog')).toBeInTheDocument()
            expect(screen.getByPlaceholderText('Search currency or country')).toBeInTheDocument()
            expect(screen.queryByText('Bank account')).not.toBeInTheDocument()
            expect(mockClaim).not.toHaveBeenCalled()
            expect(mockVerify).not.toHaveBeenCalled()
        }
    )

    it.each(['', '?method=bank'])(
        'retains an Add money search across drawer dismissal and reopening: %s',
        async (query) => {
            const onExit = show(query)
            const search = screen.getByPlaceholderText('Search currency or country')
            fireEvent.change(search, { target: { value: 'eur' } })
            expect(search).toHaveValue('eur')
            expect(screen.getByTestId('country-list')).toHaveAttribute('data-search', 'eur')
            fireEvent.click(screen.getByTestId('deposit-account-SEPA_EU'))
            expect(await screen.findByRole('dialog')).toBeInTheDocument()
            expect(screen.getByPlaceholderText('Search currency or country')).toHaveValue('eur')
            expect(screen.getByTestId('country-list')).toHaveAttribute('data-search', 'eur')
            expect(mockClaim).not.toHaveBeenCalled()
            expect(mockResolve).not.toHaveBeenCalled()
            expect(mockVerify).not.toHaveBeenCalled()

            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
            await waitFor(() =>
                expect(screen.getByTestId('corridor-gate-drawer')).toHaveAttribute('data-state', 'closed')
            )
            expect(onExit).not.toHaveBeenCalled()
            expect(screen.getByPlaceholderText('Search currency or country')).toHaveValue('eur')
            fireEvent.click(screen.getByTestId('deposit-account-SEPA_EU'))
            await waitFor(() =>
                expect(screen.getByTestId('corridor-gate-drawer')).toHaveAttribute('data-state', 'open')
            )
            expect(screen.getByPlaceholderText('Search currency or country')).toHaveValue('eur')
            expect(mockClaim).not.toHaveBeenCalled()
            expect(mockResolve).not.toHaveBeenCalled()
            expect(mockVerify).not.toHaveBeenCalled()
        },
        15000
    )
})

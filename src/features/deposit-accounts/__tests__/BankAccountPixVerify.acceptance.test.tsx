import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import messages from '@/i18n/app/messages/en.json'
import { DepositAccountsFlow } from '@/features/deposit-accounts/components/DepositAccountsFlow'
import { corridorRecord, DEPOSIT_RAIL_ORDER, emptyCorridorRecord } from '@/features/deposit-accounts/rails'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'

import { entryChip } from '@/features/kyc-features/report'
import type { BankRowsInput } from '@/utils/unlock-payments.utils'
import type { GateState } from '@/utils/capability-gate'

let mockResidence: 'BR' | 'DE'
let mockPixGate: GateState
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
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({ useDepositAccountsEnabled: () => true }))
jest.mock('@/features/deposit-accounts/useResidenceIso2s', () => ({ useResidenceIso2s: () => [mockResidence] }))
jest.mock('@/features/deposit-accounts/useEndorsementReview', () => ({ useEndorsementReview: () => undefined }))
jest.mock('@/features/deposit-accounts/useDepositGateRemediation', () => ({
    useDepositGateRemediation: () => ({ resolveGate: mockResolve, verifyCorridor: mockVerify, modals: null }),
}))
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
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
jest.mock('@/hooks/useBankRows', () => ({
    useBankRows: () => {
        const input: BankRowsInput = {
            bankChips: {
                brl:
                    mockResidence === 'BR'
                        ? 'unlock'
                        : entryChip({ state: 'refused', reason: 'local_residence_unsupported' }, []),
                ars: 'unlock',
                usd: 'unlock',
                mxn: 'unlock',
                sepa: 'unlock',
            },
            closedBecause: mockResidence === 'BR' ? {} : { brl: 'residence' },
            residenceIso2: mockResidence,
            isEuropeResidence: mockResidence === 'DE',
        }
        return { rows: jest.requireActual('@/utils/unlock-payments.utils').buildBankRows(input) }
    },
}))
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))
jest.mock('@/components/Common/CountryList', () => ({
    CountryList: ({ searchTerm }: { searchTerm: string }) => (
        <div data-testid="country-list" data-search={searchTerm}>
            Country discovery
        </div>
    ),
}))
jest.mock('@/features/deposit-accounts/useDepositCountryRouting', () => ({
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
                    gates={{
                        ...corridorRecord<GateState>(() => ({ kind: 'ready' })),
                        PIX_BR: mockPixGate,
                        SEPA_EU: { kind: 'needs-identity' },
                    }}
                    isLoading={false}
                    userName="Demo User"
                    onExit={onExit}
                    onClaim={mockClaim}
                    onResolveGate={(gate, corridor) => mockResolve(corridor, gate)}
                    onRetry={jest.fn()}
                    onContactSupport={jest.fn()}
                />
            </NuqsTestingAdapter>
        </NextIntlClientProvider>
    )
    return onExit
}

beforeEach(() => {
    jest.clearAllMocks()
    mockResidence = 'BR'
    mockPixGate = { kind: 'needs-identity' }
})

const bankAccountQuery = '?method=bank&returnTo=%2Fprofile%2Faccounts'
const pixRow = () => screen.getByTestId('bank-row-brl')

it('opens the same Verify ID drawer for an eligible BRL resident and defers remediation until the CTA', async () => {
    const onExit = show(bankAccountQuery)
    const verifyBadge = messages.depositAccounts.list.badgeVerifyId
    expect(within(screen.getByTestId('deposit-account-SEPA_EU')).getByText(verifyBadge)).toBeVisible()
    expect(within(pixRow()).getByText(verifyBadge)).toBeVisible()

    fireEvent.click(pixRow())
    const dialog = await screen.findByRole('dialog')
    expect(screen.getByText('Bank account')).toBeVisible()
    expect(pixRow()).toBeVisible()
    expect(mockClaim).not.toHaveBeenCalled()
    expect(mockResolve).not.toHaveBeenCalled()
    expect(mockVerify).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    expect(onExit).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: /verify/i }))
    await waitFor(() => {
        expect([...mockResolve.mock.calls, ...mockVerify.mock.calls].some(([corridor]) => corridor === 'PIX_BR')).toBe(
            true
        )
    })
    expect(mockClaim).not.toHaveBeenCalled()
})

it('keeps Set up and the Pix top-up path when verified identity only needs enrollment', () => {
    mockPixGate = { kind: 'needs-enrollment' }
    show(bankAccountQuery)

    expect(within(pixRow()).getByText(messages.depositAccounts.list.badgeSetUp)).toBeVisible()
    fireEvent.click(pixRow())
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/add-money\/pix(?:\?|$)/))
    expect(mockClaim).not.toHaveBeenCalled()
    expect(mockVerify).not.toHaveBeenCalled()
    expect(mockResolve).not.toHaveBeenCalled()
})

it('keeps the residence notice for an ineligible BRL nonresident', async () => {
    mockResidence = 'DE'
    mockPixGate = {
        kind: 'blocked-rejection',
        userMessage: null,
        reason: { code: 'local_residence_unsupported', userMessage: '' },
    }
    show(bankAccountQuery)

    expect(within(pixRow()).queryByText(messages.depositAccounts.list.badgeVerifyId)).not.toBeInTheDocument()
    fireEvent.click(pixRow())
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(messages.depositAccounts.corridors.PIX_BR.residenceTitle)).toBeVisible()
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockClaim).not.toHaveBeenCalled()
    expect(mockVerify).not.toHaveBeenCalled()
    expect(mockResolve).not.toHaveBeenCalled()
})

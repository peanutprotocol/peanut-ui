import { useEffect } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { activateKycFeature } from '@/app/actions/kyc-feature-activation'
import { AddMoneyBankPage } from '@/features/add-money/AddMoneyBankPage'

import type { FeatureReportEntry, NextAction } from '@/types/capabilities'
import { IntlWrapper } from '@/test-utils/intl'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'

const on = { state: 'on' } as const
let mockFresh: boolean
let mockIdentityStatus: 'verified' | 'not_started' | 'processing'
let mockNextActions: NextAction[]
let mockOneShot: boolean
let mockEur: FeatureReportEntry
let mockUsd: FeatureReportEntry
const mockProfile = () => ({
    user: { userId: 'test-user' },
    identityVerification: { oneShot: mockOneShot, status: mockIdentityStatus },
    capabilities: mockFresh
        ? undefined
        : {
              ...withFeatureReport(
                  { rails: [], nextActions: mockNextActions },
                  { identity: { status: mockIdentityStatus } }
              ),
              features: {
                  qr: on,
                  local: { ...on, accounts: { BRL: on, ARS: on } },
                  card: on,
                  bank: { ...mockUsd, accounts: { USD: mockUsd, EUR: mockEur, GBP: mockUsd, MXN: mockUsd } },
              },
          },
})
const mockPush = jest.fn()
const mockProvider = jest.fn()
const mockFetchUser = jest.fn(async () => null)
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: mockProfile(),
        fetchUser: mockFetchUser,
    }),
    useOptionalAuth: () => ({ user: mockProfile() }),
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    useParams: () => ({ country: 'germany' }),
    useSearchParams: () => new URLSearchParams('country=germany'),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/app/actions/kyc-workflow', () => ({ findKycReplacementPlan: jest.fn(async () => null) }))
jest.mock('@/app/actions/kyc-feature-activation', () => ({ activateKycFeature: jest.fn() }))
jest.mock('@/features/paperwork-verification/paperworkVerificationEntry', () => ({
    paperworkVerificationFeaturePath: (feature: string) => `/verify?feature=${feature}`,
}))
jest.mock('@/features/kill-switches/useKillSwitches', () => ({
    useKillSwitches: () => ({ disabledMantecaCurrencies: [] }),
}))
const mockSupport = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ openSupportWithMessage: mockSupport, setIsSupportModalOpen: mockSupport }),
    useModalsContextOptional: () => ({ openSupportWithMessage: mockSupport, setIsSupportModalOpen: mockSupport }),
}))

function MockProvider() {
    useEffect(() => {
        mockProvider()
    }, [])
    return <div>provider flow</div>
}
jest.mock('@/features/add-money/views/BridgeBankOnrampView', () => ({ BridgeBankOnrampView: () => <MockProvider /> }))

const entry = () => (
    <IntlWrapper>
        <NuqsTestingAdapter searchParams="?country=germany">
            <AddMoneyBankPage />
        </NuqsTestingAdapter>
    </IntlWrapper>
)

function expectNoActivation() {
    expect(screen.queryByRole('button', { name: /verify|activat|unlock|set up bank/i })).not.toBeInTheDocument()
    expect(activateKycFeature).not.toHaveBeenCalled()
    expect(mockPush.mock.calls.some(([path]) => String(path).startsWith('/verify'))).toBe(false)
}

beforeEach(() => {
    jest.clearAllMocks()
    mockFresh = false
    mockOneShot = true
    mockNextActions = []
    mockIdentityStatus = 'verified'
    mockUsd = on
    mockEur = on
})

it('shows only the selected EUR refusal and support when USD is active', () => {
    mockEur = { state: 'refused', reason: 'account_unavailable_in_residence' }
    const { container } = render(entry())
    expect(container).toHaveTextContent(/EUR|euro/i)
    expect(container).not.toHaveTextContent(/USD|US dollar/i)
    const support = screen.getByRole('button', { name: /support/i })
    expect(support).toBeVisible()
    fireEvent.click(support)
    expect(mockSupport).toHaveBeenCalledWith(true)
    expect(mockProvider).not.toHaveBeenCalled()
    expectNoActivation()
})

it.each(['pending', 'setting_up'] as const)('shows EUR %s and proceeds when EUR becomes active', (state) => {
    mockEur = { state }
    const { container, rerender } = render(entry())
    expect(container).toHaveTextContent(/EUR|euro/i)
    expect(container).toHaveTextContent(/pending|review|setting up|getting.*ready/i)
    expect(mockProvider).not.toHaveBeenCalled()
    expectNoActivation()

    mockEur = on
    rerender(entry())
    expect(screen.getByText('provider flow')).toBeVisible()
    expect(activateKycFeature).not.toHaveBeenCalled()
})

it('keeps known provisioning visible during identity review and only refreshes the profile', async () => {
    mockIdentityStatus = 'processing'
    mockEur = { state: 'setting_up' }
    let finishRead!: () => void
    mockFetchUser.mockImplementationOnce(
        () =>
            new Promise<null>((resolve) => {
                finishRead = () => resolve(null)
            })
    )

    render(entry())
    expect(screen.getByText(/setting up your EUR account/i)).toBeVisible()
    act(() => {
        window.dispatchEvent(new Event('focus'))
        window.dispatchEvent(new Event('focus'))
    })
    expect(mockFetchUser).toHaveBeenCalledTimes(1)
    expectNoActivation()
    await act(async () => finishRead())
})

it('preserves the selected currency’s missing-email action', () => {
    mockEur = { state: 'action_required', action: 'bridge-email' }
    mockNextActions = [{ key: 'bridge-email', kind: 'provide-email', purpose: 'missing_email' }]

    render(entry())
    expect(screen.getByText('provider flow')).toBeVisible()
    expectNoActivation()
})

it('shows a known selected refusal for a legacy user as well', () => {
    mockOneShot = false
    mockEur = { state: 'refused', message: 'The EUR account was declined.' }

    render(entry())
    expect(screen.getByText('The EUR account was declined.')).toBeVisible()
    expect(mockProvider).not.toHaveBeenCalled()
    expectNoActivation()
})

it.each(['verified', 'not_started'] as const)(
    'preserves explicit activation for %s identity when bank is new',
    async (status) => {
        mockIdentityStatus = status
        mockFresh = true
        jest.mocked(activateKycFeature).mockResolvedValue(
            status === 'verified' ? { kind: 'report', report: on } : { kind: 'conflict', code: 'identity_not_approved' }
        )
        render(entry())
        expect(activateKycFeature).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: /set up bank accounts/i }))
        expect(activateKycFeature).toHaveBeenCalledTimes(1)
        expect(activateKycFeature).toHaveBeenCalledWith('bank')
        if (status === 'verified') {
            expect(await screen.findByText('provider flow')).toBeVisible()
        } else {
            await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/verify'))
            expect(mockProvider).not.toHaveBeenCalled()
        }
    }
)

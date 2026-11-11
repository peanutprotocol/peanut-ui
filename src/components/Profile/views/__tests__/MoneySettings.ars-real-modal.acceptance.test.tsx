/** @jest-environment jsdom */
import { normalizeResidence } from '@/utils/residence-profile'

/**
 * Payment methods and its bank account screen — one component, two views.
 *
 * Pins the contracts that motivated the rework: a bank-method tap can never
 * route to /card (the old Europe→card hijack), the methods list is one list
 * sorted active → not active yet → unavailable with every bank currency as
 * one row, the bank screen keeps the currency rows, and restricted residences
 * read Not available. The residence lives in Profile (ResidenceMenuItem).
 */
import React from 'react'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'
import { railVerdict } from '@/utils/capability-gate'
import type { NextAction, RailCapability, IdentityVerificationStatus } from '@/types/capabilities'
import { act, render as rtlRender, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import MoneySettings from '@/components/Profile/views/MoneySettings.view'

// The view reaches for the query client (residence-change invalidation), so
// the render needs a provider even though every data hook is mocked.
const render = (page: 'accounts' | 'payments' = 'accounts') =>
    rtlRender(
        <QueryClientProvider client={new QueryClient()}>
            <MoneySettings view={page === 'accounts' ? 'bank' : 'methods'} />
        </QueryClientProvider>,
        { wrapper: IntlWrapper }
    )

const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockOpenView: string | null = null
const mockSetOpenView = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
    // NavHeader mounts the maintenance Banner, which reads the pathname
    usePathname: () => '/profile/accounts',
}))
jest.mock('nuqs', () => ({
    parseAsString: {},
    useQueryState: () => [mockOpenView, mockSetOpenView],
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))

let mockDepositEnabled = false
let mockDepositAccounts: Record<string, unknown> = {}
let mockDepositCorridors: string[] = []
let mockDepositClaimable: Record<string, unknown> = {}
let mockDepositLoading = false
// a gate for every corridor, as the real read returns: EUR and USD ready, the
// rest with no rail for this user
const mockGates = () =>
    jest
        .requireActual('@/features/deposit-accounts/rails')
        .corridorRecord((corridor: string) =>
            corridor === 'SEPA_EU' || corridor === 'ACH_US' ? { kind: 'ready' } : { kind: 'needs-enrollment' }
        )
const mockReadDepositAccounts = jest.fn((_options?: { enabled?: boolean }) => ({
    corridors: mockDepositCorridors,
    accounts: mockDepositAccounts,
    claimable: mockDepositClaimable,
    unavailable: {},
    slotsHeld: Object.keys(mockDepositAccounts).length,
    accountLimit: 2,
    gates: mockGates(),
    isLoading: mockDepositLoading,
    isError: false,
    refetch: jest.fn(),
}))
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => mockDepositEnabled,
}))
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    useDepositAccounts: (options?: { enabled?: boolean }) => mockReadDepositAccounts(options),
}))

let mockRails: unknown[] = []
let mockNextActions: unknown[] = []
// A provider rejection only surfaces for an APPROVED user, so this has to be
// settable — the residence-park case below is exactly that shape.
let mockIsKycApproved = false
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        capabilities: mockCapabilityBlock(),
        rails: mockCapabilityBlock().rails,
        isKycApproved: mockIsKycApproved,
        railsForProvider: (provider: string) =>
            (mockRails as Array<Record<string, any>>).filter((rail) => rail.provider === provider),
        nextActions: mockCapabilityBlock().nextActions,
        nextActionsForRail: () => [],
        // the real per-operation read: `operations?.[op] ?? status`, so a rail
        // that is enabled for `pay` alone can never answer yes for `deposit`
        canDo: (op: string, opts?: { provider?: string }) =>
            (mockRails as Array<Record<string, any>>).some(
                (rail) =>
                    (!opts?.provider || rail.provider === opts.provider) &&
                    ((rail.operations?.[op] as string | undefined) ?? rail.status) === 'enabled'
            ),
        // The real gate, not a second hand-rolled copy of it: the per-currency
        // chips are only as truthful as the country scoping behind them, and a
        // mock that ignores `rail.country` would pass a split these rails
        // cannot actually support. Every rail fixture below names its country.
        gateFor: (op: string, scope?: Record<string, unknown>) =>
            jest
                .requireActual('@/utils/capability-gate')
                .deriveGate(
                    { ...mockCapabilityBlock(), identityVerified: mockIsKycApproved, isLoading: false },
                    op,
                    scope
                ),
    }),
}))

let mockRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => mockRestrictions,
}))
let mockIdentity: { status: string; submittedAt?: string; reviewPending?: boolean; reason?: { code: string } } = {
    status: 'not_started',
}
let mockRegionRestricted = false
let mockTerminalFailure = false
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({
        identity: mockIdentity,
        isProcessing: mockIdentity.status === 'processing',
        isRegionRestricted: mockRegionRestricted,
        isTerminalFailure: mockTerminalFailure,
    }),
}))
jest.mock('@/components/Kyc/modals/KycRegionRestrictedModal', () => ({
    KycRegionRestrictedModal: ({ visible }: { visible: boolean }) =>
        visible ? <div>region-restricted-modal</div> : null,
}))
let mockKycDegraded = false
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => mockKycDegraded }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))

let mockUser: {
    residence?: import('@/interfaces/interfaces').ResidenceProfile
    user?: { userId: string }
} | null = null
const mockCapabilityBlock = () => {
    const nextActions = [...mockNextActions] as NextAction[]
    // The API includes descriptors for every resolved action it names.
    for (const rail of mockRails as RailCapability[]) {
        const action = rail.resolved?.nextAction
        if (action && !nextActions.some((candidate) => candidate.key === action.key)) nextActions.push(action)
    }
    const currencies: Record<string, string> = { US: 'USD', EU: 'EUR', GB: 'GBP', MX: 'MXN', BR: 'BRL', AR: 'ARS' }
    const byKey = new Map(nextActions.map((action) => [action.key, action]))
    const rails = (mockRails as RailCapability[]).map((rail) => ({
        ...rail,
        currency: rail.currency ?? currencies[rail.country],
        resolved: railVerdict(rail, byKey),
    }))
    const residence = mockUser?.residence?.verified?.country ?? mockUser?.residence?.declared?.country ?? null
    const block = withFeatureReport(
        { rails, nextActions, restrictions: [] },
        {
            identity: { ...mockIdentity, status: mockIdentity.status as IdentityVerificationStatus },
            residence,
            productRefusals: !residence ? { 'manteca.local': 'local_residence_unsupported' } : {},
            restrictions: {
                banking: mockRestrictions.banking
                    ? {
                          code: 'residence_bank_restricted',
                          userMessage: 'Bank transfers are unavailable in your country.',
                      }
                    : null,
                card: mockRestrictions.card,
            },
        }
    )
    if (mockApiCard && block.features) block.features = { ...block.features, card: mockApiCard }
    if (mockApiBank && block.features) block.features = { ...block.features, bank: mockApiBank }
    if (mockApiLocal && block.features) block.features = { ...block.features, local: mockApiLocal }
    return block
}
let mockApiCard: import('@/types/capabilities').FeatureReportEntry | null = null
let mockApiBank: import('@/types/capabilities').FeatureAccountsEntry | null = null
let mockApiLocal: import('@/types/capabilities').FeatureAccountsEntry | null = null
jest.mock('@/context/authContext', () => {
    const useAuth = () => ({
        user: mockUser
            ? { ...mockUser, capabilities: mockCapabilityBlock(), identityVerification: mockIdentity }
            : null,
    })
    return { useAuth, useOptionalAuth: useAuth }
})

jest.mock('@/hooks/useCardInfo', () => ({
    useCardInfo: () => ({ isEligible: true, hasCardAccess: true }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({ useRainCardOverview: () => ({ overview: null }) }))
let mockMantecaLimits: unknown = null
let mockBridgeLimits: unknown = null
jest.mock('@/hooks/useLimits', () => ({
    useLimits: () => ({ mantecaLimits: mockMantecaLimits, bridgeLimits: mockBridgeLimits }),
}))
const mockSetIsSupportModalOpen = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContextOptional: () => undefined,
    useModalsContext: () => ({ setIsSupportModalOpen: mockSetIsSupportModalOpen }),
}))

const mockInitiateKyc = jest.fn()
const mockRestartIdentity = jest.fn()
const mockResidenceChange = jest.fn()
const mockDismissCooldown = jest.fn()
let mockFlowCooldown: { retryAt?: string } | null = null
let mockFlowError: string | null = null
const mockSelfHealResubmit = jest.fn()
const mockFixableRejection = jest.fn()
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc: mockInitiateKyc,
        handleSelfHealResubmit: mockSelfHealResubmit,
        handleFixableRejection: mockFixableRejection,
        handleRestartIdentity: mockRestartIdentity,
        handleResidenceChange: mockResidenceChange,
        isLoading: false,
        error: mockFlowError,
        errorCooldown: mockFlowCooldown,
        dismissErrorCooldown: mockDismissCooldown,
    }),
}))

// Heavy children are irrelevant to the list contract under test.
jest.mock('@/components/Home/PendingVerificationTasks', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({ SumsubKycWrapper: () => null }))
jest.mock('@/components/Kyc/KycVerificationInProgressModal', () => ({ KycVerificationInProgressModal: () => null }))
jest.mock('@/components/Global/IframeWrapper', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Kyc/modals/KycActionRequiredModal', () => ({ KycActionRequiredModal: () => null }))
jest.mock('@/components/Kyc/modals/KycFailedModal', () => ({
    KycFailedModal: ({ visible, isTerminal }: { visible: boolean; isTerminal?: boolean }) =>
        visible ? <div>failed-modal-open:{isTerminal ? 'terminal' : 'retry'}</div> : null,
}))
jest.mock('@/features/paperwork-verification/components/IdentityCheckIntroScreen', () => ({
    IdentityCheckIntroScreen: ({
        visible,
        providerId,
        hasQuestions,
        onContinue,
    }: {
        visible: boolean
        providerId?: string | null
        hasQuestions: boolean
        onContinue: () => void
    }) =>
        visible ? (
            <div>
                unlock-modal-open:{providerId ?? 'no-provider'}:{hasQuestions ? 'questions' : 'id-only'}
                <button onClick={onContinue}>unlock now</button>
            </div>
        ) : null,
}))
jest.mock('@/components/Profile/views/ResidenceChangeDrawer', () => ({
    __esModule: true,
    default: ({
        visible,
        onClose,
        onReverify,
    }: {
        visible: boolean
        onClose: () => void
        onReverify: (targetCountry: string) => void
    }) =>
        visible ? (
            <div>
                change-modal-open
                <button onClick={onClose}>close residence</button>
                <button onClick={() => onReverify('PT')}>reverify</button>
            </div>
        ) : null,
}))
// True: the tap belongs to a Smart Paperwork Verification user, whom the hook sends to /verify.
let mockSendsToVerify = false
const mockVerifyRedirect = jest.fn()
jest.mock('@/features/paperwork-verification/usePaperworkVerificationRedirect', () => ({
    usePaperworkVerificationRedirect: (active: boolean, entry: unknown) => {
        mockVerifyRedirect(active, entry)
        return active && mockSendsToVerify
    },
}))

beforeEach(() => {
    mockSendsToVerify = false
    mockApiCard = null
    mockApiBank = null
    mockApiLocal = null
    mockDepositEnabled = false
    mockDepositAccounts = {}
    mockDepositCorridors = []
    mockDepositClaimable = {}
    mockDepositLoading = false
    mockMantecaLimits = null
    mockBridgeLimits = null
    jest.clearAllMocks()
    mockRails = []
    mockNextActions = []
    mockIsKycApproved = false
    mockRestrictions = { banking: false, card: false }
    mockUser = null
    mockIdentity = { status: 'not_started' }
    mockRegionRestricted = false
    mockTerminalFailure = false
    mockKycDegraded = false
    mockFlowError = null
    mockFlowCooldown = null
    mockOpenView = null
})


describe('independent real-modal verification after the scoped ARS wait correction', () => {
    const argentina = () => {
        mockUser = { residence: normalizeResidence({ declared: 'AR', verified: 'AR' }), user: { userId: 'synthetic-ars-user' } }
        mockIsKycApproved = true
        mockIdentity = { status: 'verified' }
        mockSendsToVerify = true
    }

    it.each([
        ['pending', 'enabled'],
        ['setting_up', 'requires-info'],
    ] as const)('scoped %s suppresses resume despite a stale %s legacy rail', (state, status) => {
        argentina()
        mockApiLocal = { state: 'on', accounts: { ARS: { state } } }
        mockRails = [
            { id: 'manteca.bank_transfer_ar', provider: 'manteca', channel: 'bank', country: 'AR', status,
              pendingSince: new Date(Date.now() - 2 * 86400000).toISOString() },
            { id: 'manteca.qr_ar', provider: 'manteca', channel: 'qr', country: 'AR', status: 'enabled' },
        ]
        render('accounts')
        fireEvent.click(screen.getByText('ARS'))
        expect(screen.getByText('Still setting up the account')).toBeInTheDocument()
        expect(screen.getByText(/still reviewing your details/)).toBeInTheDocument()
        expect(screen.queryByText(/left the verification unfinished/)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Continue verification' })).not.toBeInTheDocument()
        expect(mockInitiateKyc).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
        expect(mockInitiateKyc).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('preserves resume for a genuinely unfinished stale legacy rail when no scoped ARS entry exists', () => {
        argentina()
        mockApiLocal = { state: 'pending', accounts: {} }
        mockRails = [
            { id: 'manteca.bank_transfer_ar', provider: 'manteca', channel: 'bank', country: 'AR', status: 'pending',
              pendingSince: new Date(Date.now() - 2 * 86400000).toISOString() },
            { id: 'manteca.qr_ar', provider: 'manteca', channel: 'qr', country: 'AR', status: 'enabled' },
        ]
        expect(mockCapabilityBlock().features?.local.accounts?.ARS).toBeUndefined()
        render('accounts')
        fireEvent.click(screen.getByText('ARS'))
        expect(screen.getByText(/left the verification unfinished/)).toBeInTheDocument()
        expect(mockInitiateKyc).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Continue verification' }))
        expect(mockInitiateKyc).toHaveBeenCalledTimes(1)
        expect(mockInitiateKyc).toHaveBeenCalledWith('LATAM', undefined, true, 'AR')
    })
})

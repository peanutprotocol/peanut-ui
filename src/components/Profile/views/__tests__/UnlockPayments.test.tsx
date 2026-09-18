/** @jest-environment jsdom */
/**
 * Unlock payments — the Unlocked Regions rework.
 *
 * Pins the contracts that motivated the rework: a bank-method tap can never
 * route to /card (the old Europe→card hijack), Everywhere leads the list,
 * the residence anchor renders, and restricted residences read Not available.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import UnlockPayments from '@/components/Profile/views/UnlockPayments.view'

// The view reaches for the query client (residence-change invalidation), so
// the render needs a provider even though every data hook is mocked.
const render = () =>
    rtlRender(
        <QueryClientProvider client={new QueryClient()}>
            <UnlockPayments />
        </QueryClientProvider>,
        { wrapper: IntlWrapper }
    )

const mockPush = jest.fn()
let mockOpenView: string | null = null
const mockSetOpenView = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
    // NavHeader mounts the maintenance Banner, which reads the pathname
    usePathname: () => '/profile/unlock-payments',
}))
jest.mock('nuqs', () => ({
    parseAsString: {},
    useQueryState: () => [mockOpenView, mockSetOpenView],
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))

let mockDepositEnabled = false
let mockDepositAccounts: Record<string, unknown> = {}
const mockReadDepositAccounts = jest.fn(() => ({
    accounts: mockDepositAccounts,
    gates: { SEPA_EU: { kind: 'ready' } },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
}))
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => mockDepositEnabled,
}))
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    useDepositAccounts: () => mockReadDepositAccounts(),
}))

let mockRails: unknown[] = []
// A provider rejection only surfaces for an APPROVED user, so this has to be
// settable — the residence-park case below is exactly that shape.
let mockIsKycApproved = false
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        rails: mockRails,
        isKycApproved: mockIsKycApproved,
        railsForProvider: () => [],
        nextActionsForRail: () => [],
    }),
}))

let mockRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => mockRestrictions,
}))
let mockIdentity: { status: string; submittedAt?: string } = { status: 'not_started' }
let mockRegionRestricted = false
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({
        identity: mockIdentity,
        isProcessing: mockIdentity.status === 'processing',
        isRegionRestricted: mockRegionRestricted,
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
    residence?: { declared: string | null; verified: string | null; pending?: string | null }
    user?: { userId: string }
} | null = null
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))

jest.mock('@/hooks/useCardInfo', () => ({
    useCardInfo: () => ({ isEligible: true, hasCardAccess: true }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({ useRainCardOverview: () => ({ overview: null }) }))
let mockMantecaLimits: unknown = null
let mockBridgeLimits: unknown = null
jest.mock('@/hooks/useLimits', () => ({
    useLimits: () => ({ mantecaLimits: mockMantecaLimits, bridgeLimits: mockBridgeLimits }),
}))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))

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
jest.mock('@/components/Kyc/modals/KycProcessingModal', () => ({ KycProcessingModal: () => null }))
jest.mock('@/components/Kyc/modals/KycActionRequiredModal', () => ({ KycActionRequiredModal: () => null }))
jest.mock('@/components/Kyc/modals/KycFailedModal', () => ({ KycFailedModal: () => null }))
jest.mock('@/components/IdentityVerification/UnlockMethodModal', () => ({
    __esModule: true,
    default: ({ visible, methodLabel }: { visible: boolean; methodLabel: string | null }) =>
        visible ? <div>unlock-modal-open:{methodLabel}</div> : null,
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

describe('UnlockPayments', () => {
    beforeEach(() => {
        mockDepositEnabled = false
        mockDepositAccounts = {}
        mockMantecaLimits = null
        mockBridgeLimits = null
        jest.clearAllMocks()
        mockRails = []
        mockIsKycApproved = false
        mockRestrictions = { banking: false, card: false }
        mockUser = null
        mockIdentity = { status: 'not_started' }
        mockRegionRestricted = false
        mockKycDegraded = false
        mockFlowError = null
        mockFlowCooldown = null
        mockOpenView = null
    })

    it('opens the residence drawer from the card recovery deep link', () => {
        mockOpenView = 'residence'

        render()

        expect(screen.getByText('change-modal-open')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'close residence' }))
        expect(mockSetOpenView).toHaveBeenCalledWith(null, { history: 'replace' })
    })

    it('shows the in-review line with the submitted date while identity is processing', () => {
        mockIdentity = { status: 'processing', submittedAt: new Date(Date.now() - 2 * 86400000).toISOString() }
        render()
        expect(screen.getByText(/ID check in review since/)).toBeInTheDocument()
        expect(screen.queryByText("Message us and we'll chase it")).not.toBeInTheDocument()
    })

    it('escalates the in-review line after 7 days', () => {
        mockIdentity = { status: 'processing', submittedAt: new Date(Date.now() - 8 * 86400000).toISOString() }
        render()
        expect(screen.getByText('This is taking longer than usual.')).toBeInTheDocument()
        expect(screen.getByText("Message us and we'll chase it")).toBeInTheDocument()
    })

    it('degraded mode shows the outage banner and blocks bank-method taps', () => {
        mockKycDegraded = true
        render()
        expect(screen.getByText('Verification is temporarily down')).toBeInTheDocument()
        fireEvent.click(screen.getByText('Euro bank transfers'))
        expect(screen.queryByText(/unlock-modal-open/)).not.toBeInTheDocument()
    })

    it('leads with the merged "Your accounts" list, and the Peanut group keeps its always-on row', () => {
        render()
        // The currency-first merge (2026-09-18): the accounts list comes before
        // the separate Peanut group in the DOM, not the old Everywhere-first order.
        const accountsHeading = screen.getByText('Your accounts')
        const peanutHeading = screen.getByText('Peanut')
        expect(accountsHeading.compareDocumentPosition(peanutHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(screen.getByText('Peanut-to-Peanut payments')).toBeInTheDocument()
        expect(screen.getByText('Always on')).toBeInTheDocument()
    })

    it('a region-restricted user gets the region screen instead of an unlock offer', () => {
        mockRegionRestricted = true
        render()
        fireEvent.click(screen.getByText('Euro bank transfers'))
        expect(screen.queryByText(/unlock-modal-open/)).not.toBeInTheDocument()
        expect(screen.getByText('region-restricted-modal')).toBeInTheDocument()
        expect(mockInitiateKyc).not.toHaveBeenCalled()
    })

    it('a bank-method tap opens the method-worded unlock modal and NEVER routes to /card', () => {
        render()
        fireEvent.click(screen.getByText('Euro bank transfers'))
        expect(screen.getByText('unlock-modal-open:Euro bank transfers')).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('the card row routes to /card and only the card row does', () => {
        render()
        fireEvent.click(screen.getByText('Peanut card'))
        expect(mockPush).toHaveBeenCalledWith('/card')
    })

    it("shows the verified residence anchor and floats that region's rows to the top of the merged list", () => {
        mockUser = { residence: { declared: 'BR', verified: 'BR' } }
        render()
        expect(screen.getByText('Residence: Brazil')).toBeInTheDocument()
        expect(screen.getByText('Verified')).toBeInTheDocument()
        // Region headers are gone (2026-09-18 currency-first merge), so the
        // "floats up" contract now shows in row order: the residence's own
        // region (South America) sorts before the others in the merged list.
        const brazilRow = screen.getByText('PIX (Brazil), QR & bank transfers (Argentina)')
        const europeRow = screen.getByText('Euro bank transfers')
        expect(brazilRow.compareDocumentPosition(europeRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('a fully restricted residence reads Not available on bank rows but keeps the always-on row', () => {
        mockRestrictions = { banking: true, card: true }
        render()
        expect(screen.getAllByText('Not available').length).toBeGreaterThanOrEqual(4)
        expect(screen.getByText('Always on')).toBeInTheDocument()
        fireEvent.click(screen.getByText('Euro bank transfers'))
        expect(screen.queryByText(/unlock-modal-open/)).not.toBeInTheDocument()
    })

    it('the residence Change link opens the change modal', () => {
        mockUser = { residence: { declared: 'BR', verified: 'BR' }, user: { userId: 'u1' } }
        render()
        fireEvent.click(screen.getByLabelText('Change'))
        expect(screen.getByText('change-modal-open')).toBeInTheDocument()
    })

    it('a failed residence re-verification reads as retriable, not "Not available yet"', () => {
        mockUser = { residence: { declared: 'BR', verified: 'BR', pending: 'ES' }, user: { userId: 'u1' } }
        mockFlowError = 'Not Found'
        render()
        expect(screen.getByText('Not available yet')).toBeInTheDocument()

        fireEvent.click(screen.getByLabelText('Change'))
        fireEvent.click(screen.getByText('reverify'))
        expect(mockResidenceChange).toHaveBeenNthCalledWith(1, 'PT')
        expect(mockRestartIdentity).not.toHaveBeenCalled()

        expect(screen.getByText("Verification couldn't start")).toBeInTheDocument()
        expect(screen.queryByText('Not available yet')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('Try again'))
        expect(mockResidenceChange).toHaveBeenNthCalledWith(2, 'PT')
        expect(mockInitiateKyc).not.toHaveBeenCalled()
    })

    it('shows a dated cooldown with one dismiss button', async () => {
        mockFlowError = 'Too many requests'
        mockFlowCooldown = { retryAt: '2026-09-08T18:57:00Z' }
        render()
        expect(screen.getByText('Give it a little time')).toBeInTheDocument()
        expect(screen.getByText(/You can try again after/)).toHaveTextContent(/Sep 8/)
        expect(screen.queryByText('Try again')).not.toBeInTheDocument()
        expect(screen.queryByText('Contact support')).not.toBeInTheDocument()
        expect(screen.queryByText('Too many requests')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText("I'll try later"))
        expect(mockDismissCooldown).toHaveBeenCalled()
    })

    it('an active LATAM rail shows the inline monthly limit bar on Brazil', () => {
        mockRails = [{ id: 'manteca.bank', provider: 'manteca', channel: 'bank', status: 'enabled' }]
        mockMantecaLimits = [
            {
                exchangeCountry: 'BRA',
                type: 'EXCHANGE',
                asset: 'BRL',
                yearlyLimit: '120000',
                availableYearlyLimit: '100000',
                monthlyLimit: '10000',
                availableMonthlyLimit: '2500',
            },
        ]
        render()
        expect(screen.getByText(/left this month/)).toBeInTheDocument()
    })

    it('an active Bridge rail names deposit and withdrawal limits separately', () => {
        mockRails = [{ id: 'bridge.ach', provider: 'bridge', channel: 'bank', status: 'enabled' }]
        mockBridgeLimits = { onRampPerTransaction: '25000', offRampPerTransaction: '50000', asset: 'USD' }
        render()
        expect(screen.getAllByText('Per bank deposit').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Per bank withdrawal').length).toBeGreaterThan(0)
        expect(screen.getAllByText('$25,000').length).toBeGreaterThan(0)
        expect(screen.getAllByText('$50,000').length).toBeGreaterThan(0)
    })

    it('active payment rows explain the method in a drawer', () => {
        render()
        fireEvent.click(screen.getByText('Peanut-to-Peanut payments'))

        const drawer = screen.getByRole('dialog')
        expect(within(drawer).getByText('Send and receive money with other Peanut users.')).toBeInTheDocument()
        expect(within(drawer).getByText('No limits on Peanut-to-Peanut payments')).toBeInTheDocument()
        expect(mockInitiateKyc).not.toHaveBeenCalled()
    })

    it('held bank accounts reuse account details, retain the profile return path, and drop the duplicate unlock row', () => {
        mockDepositEnabled = true
        mockDepositAccounts = {
            SEPA_EU: { status: 'active', instructions: {}, matching: { sender: 'business-only' } },
        }
        render()

        expect(screen.getByText('Your accounts')).toBeInTheDocument()
        fireEvent.click(screen.getByText('EUR · SEPA'))
        expect(mockPush).toHaveBeenCalledWith(
            '/add-money?method=bank&step=details&corridor=SEPA_EU&returnTo=%2Fprofile%2Fidentity-verification'
        )
        // A held EUR VA covers the same corridor as the "Euro bank transfers"
        // unlock row (2026-09-18 currency-first merge) — the merged list
        // shows it once, not twice.
        expect(screen.queryByText('Euro bank transfers')).not.toBeInTheDocument()
    })

    it('does not query bank accounts while their rollout flag is off, but still shows the unlock rows', () => {
        mockReadDepositAccounts.mockClear()
        render()
        expect(mockReadDepositAccounts).not.toHaveBeenCalled()
        // The merged "Your accounts" list still renders the KYC-unlock bank/QR
        // rows with the flag off — only the VA fetch (and its rows) are gated.
        expect(screen.getByText('Your accounts')).toBeInTheDocument()
        expect(screen.getByText('Euro bank transfers')).toBeInTheDocument()
    })

    it('states the P2P no-limit fact even before anything is unlocked', () => {
        render()
        expect(screen.getByText('No limits on Peanut-to-Peanut payments')).toBeInTheDocument()
    })

    // A residence-parked rail. The TOP-LEVEL status is `blocked` (the backend maps
    // REQUIRES_SUPPORT that way); only `resolved.status` is fixable. That is what
    // makes `hasFunctionalRail` treat the region as LOCKED, so this modal is the
    // surface the cohort actually reaches (TASK-22286).
    const residenceParkedRail = {
        id: 'bridge.sepa_eu',
        provider: 'bridge',
        channel: 'bank',
        country: 'DE',
        status: 'blocked',
        reason: {
            code: 'residence_unresolved',
            userMessage: 'We still need your home address to finish setting up bank transfers.',
        },
        resolved: {
            status: 'fixable',
            blocking: {
                code: 'residence_unresolved',
                userMessage: 'We still need your home address to finish setting up bank transfers.',
                selfHealable: true,
                selfHealKind: 'document-resubmit',
            },
            nextAction: {
                key: 'sumsub:address_of_residence',
                kind: 'sumsub',
                purpose: 'bridge-rfi',
                levelKey: 'address_of_residence',
            },
        },
    }

    it('a residence park opens the address step, not the resubmit that 404s for it', () => {
        mockRails = [residenceParkedRail]
        mockIsKycApproved = true
        render()
        fireEvent.click(screen.getByText('Euro bank transfers'))
        fireEvent.click(screen.getByText('Upload document'))

        expect(mockFixableRejection).toHaveBeenCalledWith(
            expect.objectContaining({ provider: 'BRIDGE', reasonCode: 'residence_unresolved' })
        )
        expect(mockSelfHealResubmit).not.toHaveBeenCalled()
    })

    it('every other fixable rejection here still takes resubmit — Manteca is untouched', () => {
        mockRails = [
            {
                ...residenceParkedRail,
                id: 'manteca.pix_br',
                provider: 'manteca',
                country: 'BR',
                reason: { code: 'source_of_funds', userMessage: 'We need information about your source of funds.' },
                resolved: {
                    ...residenceParkedRail.resolved,
                    blocking: { ...residenceParkedRail.resolved.blocking, code: 'source_of_funds' },
                    nextAction: { ...residenceParkedRail.resolved.nextAction, key: 'sumsub:source_of_funds' },
                },
            },
        ]
        mockIsKycApproved = true
        render()
        fireEvent.click(screen.getByText('PIX (Brazil), QR & bank transfers (Argentina)'))
        fireEvent.click(screen.getByText('Upload document'))

        expect(mockSelfHealResubmit).toHaveBeenCalledWith('MANTECA')
        expect(mockFixableRejection).not.toHaveBeenCalled()
    })

    it('a pending residence verification is surfaced without replacing the active country', () => {
        mockUser = { residence: { declared: 'BR', verified: 'BR', pending: 'ES' }, user: { userId: 'u1' } }
        render()
        expect(screen.getByText('Change to Spain pending verification')).toBeInTheDocument()
    })
})

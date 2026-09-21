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
    gates: { SEPA_EU: { kind: 'ready' }, ACH_US: { kind: 'ready' } },
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
        // the real per-operation read: `operations?.[op] ?? status`, so a rail
        // that is enabled for `pay` alone can never answer yes for `deposit`
        canDo: (op: string, opts?: { provider?: string }) =>
            (mockRails as Array<Record<string, any>>).some(
                (rail) =>
                    (!opts?.provider || rail.provider === opts.provider) &&
                    ((rail.operations?.[op] as string | undefined) ?? rail.status) === 'enabled'
            ),
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
        fireEvent.click(screen.getByText('EUR · Bank transfer'))
        expect(screen.queryByText(/unlock-modal-open/)).not.toBeInTheDocument()
    })

    it('leads with the ways-in list, and the Peanut group keeps its always-on row', () => {
        render()
        // The currency-first merge (2026-09-18): the accounts list comes before
        // the separate Peanut group in the DOM, not the old Everywhere-first order.
        // The user holds no account here, so only the second section renders —
        // an empty "Your account numbers" heading would promise details that do
        // not exist.
        expect(screen.queryByText('Your account numbers')).not.toBeInTheDocument()
        const accountsHeading = screen.getByText('Add and withdraw money')
        const peanutHeading = screen.getByText('Peanut')
        expect(accountsHeading.compareDocumentPosition(peanutHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(screen.getByText('Peanut-to-Peanut payments')).toBeInTheDocument()
        // P2P and crypto both carry the always-on chip.
        expect(screen.getAllByText('Always on').length).toBeGreaterThanOrEqual(2)
    })

    it('a region-restricted user gets the region screen instead of an unlock offer', () => {
        mockRegionRestricted = true
        render()
        fireEvent.click(screen.getByText('EUR · Bank transfer'))
        expect(screen.queryByText(/unlock-modal-open/)).not.toBeInTheDocument()
        expect(screen.getByText('region-restricted-modal')).toBeInTheDocument()
        expect(mockInitiateKyc).not.toHaveBeenCalled()
    })

    it('a bank-method tap opens the method-worded unlock modal and NEVER routes to /card', () => {
        render()
        fireEvent.click(screen.getByText('EUR · Bank transfer'))
        expect(screen.getByText('unlock-modal-open:EUR · Bank transfer')).toBeInTheDocument()
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
        const brazilRow = screen.getByText('BRL and ARS · Pix and bank transfer')
        const europeRow = screen.getByText('EUR · Bank transfer')
        expect(brazilRow.compareDocumentPosition(europeRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('a fully restricted residence reads Not available on bank rows but keeps the always-on row', () => {
        mockRestrictions = { banking: true, card: true }
        render()
        expect(screen.getAllByText('Not available').length).toBeGreaterThanOrEqual(4)
        // Both P2P and crypto are always-on and untouched by a bank/card restriction.
        expect(screen.getAllByText('Always on').length).toBeGreaterThanOrEqual(2)
        fireEvent.click(screen.getByText('EUR · Bank transfer'))
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

    /**
     * The two things this screen holds are not the same thing, and they used to
     * share a word. "Active" meant BOTH "your verification lets you use this
     * bank rail" and "you hold an account that is active but not shareable" —
     * one on each screen. A user could not tell rail access from an account in
     * their own name, which is the whole difference: somebody else can pay into
     * an account number, and nobody can pay into rail access.
     *
     * The four states a user can be in, in order.
     */
    describe('rail access and an account in your name read as different things', () => {
        it('no rail: the ways-in section offers the unlock, and promises no account number', () => {
            render()

            expect(screen.getByText('Add and withdraw money')).toBeInTheDocument()
            expect(screen.getByText('Move money between your bank and Peanut in these currencies.')).toBeInTheDocument()
            expect(screen.queryByText('Your account numbers')).not.toBeInTheDocument()
            expect(screen.getAllByText('Unlock').length).toBeGreaterThan(0)
            // the word that meant two things is gone from the vocabulary
            expect(screen.queryByText('Active')).not.toBeInTheDocument()
        })

        it('rail only: the row reads Available, and still no account numbers section', () => {
            mockRails = [{ id: 'bridge.ach', provider: 'bridge', channel: 'bank', status: 'enabled' }]
            render()

            expect(screen.getAllByText('Available').length).toBeGreaterThan(0)
            expect(screen.queryByText('Active')).not.toBeInTheDocument()
            expect(screen.queryByText('Your account numbers')).not.toBeInTheDocument()
        })

        /*
         * A corridor the user could open is not one they hold. Accounts &
         * payments lists only held accounts, so the heading stays away until
         * there are details to put under it — claiming happens on Add money.
         */
        it('rail and an account they could open: still rail access only', () => {
            mockDepositEnabled = true
            mockRails = [{ id: 'bridge.ach', provider: 'bridge', channel: 'bank', status: 'enabled' }]
            mockDepositAccounts = {}
            render()

            expect(screen.queryByText('Your account numbers')).not.toBeInTheDocument()
            expect(screen.getByText('Add and withdraw money')).toBeInTheDocument()
        })

        it('an account held: it gets its own section, its own words, and Ready', () => {
            mockDepositEnabled = true
            mockRails = [{ id: 'bridge.sepa', provider: 'bridge', channel: 'bank', status: 'enabled' }]
            mockDepositAccounts = {
                SEPA_EU: { status: 'active', instructions: {}, matching: { sender: 'anyone' } },
            }
            render()

            expect(screen.getByText('Your account numbers')).toBeInTheDocument()
            expect(
                screen.getByText(
                    'Bank details in your name. Give them to someone else and the money arrives in Peanut.'
                )
            ).toBeInTheDocument()
            // a payer can be handed these details; rail access never says Ready
            expect(screen.getByText('Ready')).toBeInTheDocument()
            expect(screen.queryByText('Active')).not.toBeInTheDocument()
        })
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
        expect(within(drawer).getByText('No amount limits on Peanut-to-Peanut payments or crypto')).toBeInTheDocument()
        expect(mockInitiateKyc).not.toHaveBeenCalled()
    })

    it('held bank accounts reuse account details, retain the profile return path, and drop the duplicate active row', () => {
        mockDepositEnabled = true
        mockRails = [{ id: 'bridge.sepa', provider: 'bridge', channel: 'bank', status: 'enabled' }]
        mockDepositAccounts = {
            SEPA_EU: { status: 'active', instructions: {}, matching: { sender: 'business-only' } },
        }
        render()

        // The two pathways are named apart: the account the user holds sits
        // under its own heading, and the corridors their verification opens sit
        // under the other. One list called "Your accounts" said both were the
        // same thing, under a subtitle promising account numbers to share.
        expect(screen.getByText('Your account numbers')).toBeInTheDocument()
        expect(screen.getByText('Add and withdraw money')).toBeInTheDocument()
        fireEvent.click(screen.getByText('EUR · SEPA'))
        expect(mockPush).toHaveBeenCalledWith(
            '/add-money?method=bank&step=details&corridor=SEPA_EU&returnTo=%2Fprofile%2Faccounts-and-payments'
        )
        // An active EUR account covers the same corridor as the active "Euro
        // bank transfers" row (2026-09-18 currency-first merge) — the merged
        // list shows it once, not twice.
        expect(screen.queryByText('EUR · Bank transfer')).not.toBeInTheDocument()
    })

    it('keeps the bank row when the account cannot stand in for it', () => {
        mockDepositEnabled = true
        // a revoked account covers nothing, and the row is the only way into
        // the unlock or fix modal for that rail
        mockDepositAccounts = {
            SEPA_EU: { status: 'revoked', instructions: {}, matching: { sender: 'business-only' } },
        }
        render()

        expect(screen.getByText('EUR · SEPA')).toBeInTheDocument()
        expect(screen.getByText('EUR · Bank transfer')).toBeInTheDocument()
    })

    it('keeps the bank limits when an account row replaces the bank row they came from', () => {
        mockDepositEnabled = true
        mockRails = [{ id: 'bridge.ach', provider: 'bridge', channel: 'bank', status: 'enabled' }]
        mockBridgeLimits = { onRampPerTransaction: '25000', offRampPerTransaction: '50000', asset: 'USD' }
        mockDepositAccounts = {
            SEPA_EU: { status: 'active', instructions: {}, matching: { sender: 'anyone' } },
            ACH_US: { status: 'active', instructions: {}, matching: { sender: 'anyone' } },
        }
        render()

        expect(screen.queryByText('EUR · Bank transfer')).not.toBeInTheDocument()
        expect(screen.getAllByText('Per bank withdrawal').length).toBeGreaterThan(0)
    })

    it.each([
        ['off', false],
        ['on', true],
    ])('joins the bank rows into one card with the accounts flag %s', (_, enabled) => {
        mockDepositEnabled = enabled
        render()

        // ListGroup positions its direct children: every row after the first
        // drops its top border. Rows behind a wrapper component each kept all
        // four and rendered as separate cards.
        const rows = ['EUR · Bank transfer', 'USD and MXN · Bank transfer'].map((title) =>
            screen.getByText(title).closest('.border')
        )
        const group = rows[0]?.parentElement
        expect(rows[1]?.parentElement).toBe(group)
        expect(group?.querySelectorAll(':scope > .border:not(.border-t-0)')).toHaveLength(1)
    })

    it('does not query bank accounts while their rollout flag is off, but still shows the unlock rows', () => {
        mockReadDepositAccounts.mockClear()
        render()
        expect(mockReadDepositAccounts).not.toHaveBeenCalled()
        // The ways-in list still renders the KYC-unlock bank/QR rows with the
        // flag off — only the VA fetch (and its rows) are gated. With no
        // standing accounts at all, the account-numbers heading must not appear.
        expect(screen.getByText('Add and withdraw money')).toBeInTheDocument()
        expect(screen.queryByText('Your account numbers')).not.toBeInTheDocument()
        expect(screen.getByText('EUR · Bank transfer')).toBeInTheDocument()
    })

    it('states the P2P no-limit fact even before anything is unlocked', () => {
        render()
        expect(screen.getByText('No amount limits on Peanut-to-Peanut payments or crypto')).toBeInTheDocument()
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
        fireEvent.click(screen.getByText('EUR · Bank transfer'))
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
        fireEvent.click(screen.getByText('BRL and ARS · Pix and bank transfer'))
        fireEvent.click(screen.getByText('Upload document'))

        expect(mockSelfHealResubmit).toHaveBeenCalledWith('MANTECA')
        expect(mockFixableRejection).not.toHaveBeenCalled()
    })

    /**
     * Holding a rail is not being allowed to use it. Every Sumsub-approved
     * user is enrolled on the QR-tier Manteca rails whatever their residence:
     * `pay` is enabled, `deposit` and `withdraw` wait for the full account. A
     * row that adds and withdraws money must read that operation, or a
     * verified German is told Brazilian and Argentine bank transfers are
     * Available — with no tap into the onboarding that would make it true.
     */
    describe('a bank row states the operation it names, not the rail behind it', () => {
        const qrPoolRail = {
            id: 'manteca.pix_br',
            provider: 'manteca',
            channel: 'bank',
            country: 'BR',
            status: 'enabled',
            operations: { pay: 'enabled', deposit: 'requires-info', withdraw: 'requires-info' },
        }

        it('a QR-pool user can pay by QR, and is offered the bank unlock', () => {
            mockRails = [qrPoolRail]
            mockIsKycApproved = true
            render()

            const bankRow = screen.getByText('BRL and ARS · Pix and bank transfer')
            expect(within(bankRow.closest('.border') as HTMLElement).getByText('Unlock')).toBeInTheDocument()
            const qrRow = screen.getByText('QR payments · Brazil and Argentina')
            expect(within(qrRow.closest('.border') as HTMLElement).getByText('Available')).toBeInTheDocument()

            // the row is the way into the onboarding that makes it true
            fireEvent.click(bankRow)
            expect(screen.getByText('unlock-modal-open:BRL and ARS · Pix and bank transfer')).toBeInTheDocument()
        })

        it('a full Manteca account reads Available on both rows', () => {
            mockRails = [{ ...qrPoolRail, operations: { pay: 'enabled', deposit: 'enabled', withdraw: 'enabled' } }]
            mockIsKycApproved = true
            render()

            const bankRow = screen.getByText('BRL and ARS · Pix and bank transfer')
            expect(within(bankRow.closest('.border') as HTMLElement).getByText('Available')).toBeInTheDocument()
            const qrRow = screen.getByText('QR payments · Brazil and Argentina')
            expect(within(qrRow.closest('.border') as HTMLElement).getByText('Available')).toBeInTheDocument()
        })

        // North America and Europe hold the same class of gap: the rail exists,
        // the operation does not. A mid-flight rail keeps its own Processing
        // chip (pendingBankRailRegionPaths, unchanged) — what it must never
        // say is Available.
        it('a Bridge rail that cannot move money yet never reads Available', () => {
            mockRails = [
                {
                    id: 'bridge.ach_us',
                    provider: 'bridge',
                    channel: 'bank',
                    country: 'US',
                    status: 'requires-info',
                    operations: { deposit: 'requires-info', withdraw: 'requires-info' },
                },
            ]
            mockIsKycApproved = true
            render()

            const row = screen.getByText('USD and MXN · Bank transfer').closest('.border') as HTMLElement
            expect(within(row).queryByText('Available')).not.toBeInTheDocument()
            expect(within(row).getByText('Processing')).toBeInTheDocument()
        })
    })

    /**
     * Spending is not adding or withdrawing money, and the two used to share
     * one list: QR payments were a word inside a bank row titled after a bank
     * transfer, so a verified user could not tell that they can already pay a
     * shop in Brazil or Argentina.
     */
    describe('the Spend section', () => {
        it('names the card and QR payments, and offers QR to a user without it', () => {
            render()

            const spendHeading = screen.getByText('Spend')
            const bankHeading = screen.getByText('Add and withdraw money')
            expect(bankHeading.compareDocumentPosition(spendHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
            expect(screen.getByText('Peanut card')).toBeInTheDocument()
            expect(screen.getByText('QR payments · Brazil and Argentina')).toBeInTheDocument()
            expect(
                screen.getByText('Pay in shops by scanning a QR code. Open to every verified user.')
            ).toBeInTheDocument()

            // no Manteca rail yet: the row is the same unlock offer the bank
            // row is, and the tap opens the same region intent
            fireEvent.click(screen.getByText('QR payments · Brazil and Argentina'))
            expect(screen.getByText('unlock-modal-open:QR payments · Brazil and Argentina')).toBeInTheDocument()
            expect(mockPush).not.toHaveBeenCalled()
        })

        it('reads Available once the QR rail is live, and explains itself in the drawer', () => {
            mockRails = [{ id: 'manteca.bank', provider: 'manteca', channel: 'bank', status: 'enabled' }]
            render()

            const qrRow = screen.getByText('QR payments · Brazil and Argentina')
            fireEvent.click(qrRow)
            const drawer = screen.getByRole('dialog')
            expect(
                within(drawer).getByText('Pay in shops in Brazil and Argentina by scanning a QR code.')
            ).toBeInTheDocument()
            expect(mockInitiateKyc).not.toHaveBeenCalled()
        })

        it('the bank list never mentions QR any more', () => {
            render()

            const bankRow = screen.getByText('BRL and ARS · Pix and bank transfer')
            expect(bankRow.textContent).not.toMatch(/QR/)
        })
    })

    it('a pending residence verification is surfaced without replacing the active country', () => {
        mockUser = { residence: { declared: 'BR', verified: 'BR', pending: 'ES' }, user: { userId: 'u1' } }
        render()
        expect(screen.getByText('Change to Spain pending verification')).toBeInTheDocument()
    })
})

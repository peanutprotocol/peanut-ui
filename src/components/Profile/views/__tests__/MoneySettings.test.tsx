/** @jest-environment jsdom */
/**
 * The Accounts and Payments profile pages — one screen, two lists.
 *
 * Pins the contracts that motivated the rework: a bank-method tap can never
 * route to /card (the old Europe→card hijack), the residence anchor leads both
 * pages, each page lists only its own rows (Pix and ARS on both), and
 * restricted residences read Not available.
 */
import React from 'react'
import { act, render as rtlRender, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import MoneySettings from '@/components/Profile/views/MoneySettings.view'

// The view reaches for the query client (residence-change invalidation), so
// the render needs a provider even though every data hook is mocked.
const render = (page: 'accounts' | 'payments' = 'accounts') =>
    rtlRender(
        <QueryClientProvider client={new QueryClient()}>
            <MoneySettings page={page} />
        </QueryClientProvider>,
        { wrapper: IntlWrapper }
    )

const mockPush = jest.fn()
let mockOpenView: string | null = null
const mockSetOpenView = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
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
// a gate for every corridor, as the real read returns: EUR and USD ready, the
// rest with no rail for this user
const mockGates = () =>
    jest
        .requireActual('@/features/deposit-accounts/rails')
        .corridorRecord((corridor: string) =>
            corridor === 'SEPA_EU' || corridor === 'ACH_US' ? { kind: 'ready' } : { kind: 'needs-enrollment' }
        )
const mockReadDepositAccounts = jest.fn(() => ({
    corridors: mockDepositCorridors,
    accounts: mockDepositAccounts,
    claimable: mockDepositClaimable,
    unavailable: {},
    slotsHeld: Object.keys(mockDepositAccounts).length,
    accountLimit: 2,
    gates: mockGates(),
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
        railsForProvider: (provider: string) =>
            (mockRails as Array<Record<string, any>>).filter((rail) => rail.provider === provider),
        nextActions: [],
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
                    { rails: mockRails, nextActions: [], identityVerified: mockIsKycApproved, isLoading: false },
                    op,
                    scope
                ),
    }),
}))

let mockRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => mockRestrictions,
}))
let mockIdentity: { status: string; submittedAt?: string; reviewPending?: boolean } = { status: 'not_started' }
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
    residence?: {
        declared: string | null
        verified: string | null
        pending?: string | null
        declaredSecond?: string | null
    }
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
const mockSetIsSupportModalOpen = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
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
jest.mock('@/components/Kyc/modals/KycProcessingModal', () => ({
    KycProcessingModal: ({ visible, pendingSince }: { visible: boolean; pendingSince?: string | null }) =>
        visible ? <div>processing-modal-open:{pendingSince ?? 'fresh'}</div> : null,
}))
jest.mock('@/components/Kyc/modals/KycActionRequiredModal', () => ({ KycActionRequiredModal: () => null }))
jest.mock('@/components/Kyc/modals/KycFailedModal', () => ({ KycFailedModal: () => null }))
jest.mock('@/components/IdentityVerification/UnlockMethodModal', () => ({
    __esModule: true,
    default: ({
        visible,
        methodLabel,
        onUnlock,
    }: {
        visible: boolean
        methodLabel: string | null
        onUnlock: () => void
    }) =>
        visible ? (
            <div>
                unlock-modal-open:{methodLabel}
                <button onClick={onUnlock}>unlock now</button>
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

describe('MoneySettings', () => {
    beforeEach(() => {
        mockDepositEnabled = false
        mockDepositAccounts = {}
        mockDepositCorridors = []
        mockDepositClaimable = {}
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
        mockIdentity = {
            status: 'processing',
            reviewPending: true,
            submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        }
        render()
        expect(screen.getByText(/ID check in review since/)).toBeInTheDocument()
        expect(screen.queryByText("Message us and we'll chase it")).not.toBeInTheDocument()
    })

    it('does not show or escalate the notice without a confirmed submission signal', () => {
        mockIdentity = { status: 'processing', submittedAt: new Date(Date.now() - 8 * 86400000).toISOString() }
        render()
        expect(screen.queryByText(/ID check in review/)).not.toBeInTheDocument()
        expect(screen.queryByText("Message us and we'll chase it")).not.toBeInTheDocument()
    })

    it('escalates the in-review line after 7 days', () => {
        mockIdentity = {
            status: 'processing',
            reviewPending: true,
            submittedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
        }
        render()
        expect(screen.getByText('This is taking longer than usual.')).toBeInTheDocument()
        const supportLink = screen.getByRole('button', { name: "Message us and we'll chase it" })
        expect(supportLink).toHaveClass('underline')
        fireEvent.click(supportLink)
        expect(mockSetIsSupportModalOpen).toHaveBeenCalledWith(true)
    })

    it('degraded mode shows the outage banner and blocks bank-method taps', () => {
        mockKycDegraded = true
        render()
        expect(screen.getByText('Verification is temporarily down')).toBeInTheDocument()
        fireEvent.click(screen.getByText('EUR'))
        expect(screen.queryByText(/unlock-modal-open/)).not.toBeInTheDocument()
        // the tap says why instead of doing nothing (QA-20)
        expect(
            within(screen.getByTestId('closed-row-drawer')).getByText('Verification is temporarily down')
        ).toBeInTheDocument()
    })

    /**
     * The split (hugo, 2026-09-25): Accounts holds the accounts and the other
     * ways money moves in and out; Payments holds the ways to spend and the
     * Peanut rows. Pix and ARS are both, so each shows on both pages.
     */
    describe('two pages, one screen', () => {
        it('Accounts lists the ways money moves in and out, and no spend or Peanut rows', () => {
            render('accounts')
            expect(screen.getByText('Accounts')).toBeInTheDocument()
            // The user holds no account here, so no held section renders — an
            // empty heading would promise details that do not exist.
            expect(screen.queryByTestId('virtual-accounts')).not.toBeInTheDocument()
            expect(screen.getByText('Other ways to move money with Peanut')).toBeInTheDocument()
            for (const title of ['BRL', 'ARS', 'USD', 'MXN', 'EUR']) expect(screen.getByText(title)).toBeInTheDocument()
            for (const title of ['Spend', 'Peanut', 'Peanut card', 'Peanut-to-Peanut payments', 'Crypto']) {
                expect(screen.queryByText(title)).not.toBeInTheDocument()
            }
        })

        it('Payments lists the spend methods and the Peanut rows, and no bank rows', () => {
            render('payments')
            expect(screen.getByText('Payments')).toBeInTheDocument()
            expect(screen.getByText('Spend')).toBeInTheDocument()
            expect(screen.getByText('Peanut card')).toBeInTheDocument()
            expect(screen.getByText('Peanut-to-Peanut payments')).toBeInTheDocument()
            // P2P and crypto both carry the always-on chip.
            expect(screen.getAllByText('Always on').length).toBeGreaterThanOrEqual(2)
            expect(screen.queryByText('Other ways to move money with Peanut')).not.toBeInTheDocument()
            for (const title of ['BRL', 'ARS', 'USD', 'MXN', 'EUR']) {
                expect(screen.queryByText(title)).not.toBeInTheDocument()
            }
        })

        it.each(['accounts', 'payments'] as const)('the %s page leads with the residence row', (page) => {
            mockUser = { residence: { declared: 'BR', verified: 'BR' }, user: { userId: 'u1' } }
            render(page)
            const residence = screen.getByText('Residence')
            const firstList = screen.getByText(page === 'accounts' ? 'Other ways to move money with Peanut' : 'Spend')
            expect(residence.compareDocumentPosition(firstList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
            fireEvent.click(screen.getByLabelText('Change'))
            expect(screen.getByText('change-modal-open')).toBeInTheDocument()
        })

        // Pix: paying a Pix QR or key is spending, sending reais by Pix is
        // moving money. ARS: QR payments are spending, a bank transfer is not.
        it('Pix and ARS show on both pages, each as the thing that page is about', () => {
            mockUser = { residence: { declared: 'BR', verified: 'BR', declaredSecond: 'AR' }, user: { userId: 'u1' } }
            const { unmount } = render('accounts')
            expect(screen.getByText('BRL')).toBeInTheDocument()
            expect(screen.getByText('ARS')).toBeInTheDocument()
            unmount()

            render('payments')
            expect(screen.getByText('QR payments')).toBeInTheDocument()
            expect(screen.getByText('Brazil and Argentina')).toBeInTheDocument()
        })
    })

    it('a region-restricted user gets the region screen instead of an unlock offer', () => {
        mockRegionRestricted = true
        render()
        fireEvent.click(screen.getByText('EUR'))
        expect(screen.queryByText(/unlock-modal-open/)).not.toBeInTheDocument()
        expect(screen.getByText('region-restricted-modal')).toBeInTheDocument()
        expect(mockInitiateKyc).not.toHaveBeenCalled()
    })

    it('a bank-method tap opens the method-worded unlock modal and NEVER routes to /card', () => {
        render()
        fireEvent.click(screen.getByText('EUR'))
        expect(screen.getByText('unlock-modal-open:EUR · Bank transfer')).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('the card row routes to /card and only the card row does', () => {
        render('payments')
        fireEvent.click(screen.getByText('Peanut card'))
        expect(mockPush).toHaveBeenCalledWith('/card')
    })

    it("shows the verified residence anchor and floats that region's rows to the top of the merged list", () => {
        mockUser = { residence: { declared: 'BR', verified: 'BR' } }
        render()
        // two-line row: the country never shares a truncating line with the pill
        expect(screen.getByText('Residence')).toBeInTheDocument()
        expect(screen.getByText('Brazil')).toHaveClass('whitespace-normal')
        expect(screen.getByText('Verified')).toHaveClass('bg-background-badge-success')
        // Region headers are gone (2026-09-18 currency-first merge), so the
        // "floats up" contract now shows in row order: the residence's own
        // region (South America) sorts before the others in the merged list.
        const brazilRow = screen.getByText('BRL')
        const europeRow = screen.getByText('EUR')
        expect(brazilRow.compareDocumentPosition(europeRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('an unconfirmed residence reads as a neutral badge, beside the verified one', () => {
        mockUser = { residence: { declared: 'BR', verified: null } }
        render()
        expect(screen.getByText('Not confirmed')).toHaveClass('bg-background-badge-helper')
        expect(screen.getByText('Brazil')).toHaveClass('whitespace-normal')
    })

    it('a fully restricted residence reads Not available on bank rows but keeps the always-on row', () => {
        mockRestrictions = { banking: true, card: true }
        const { unmount } = render()
        expect(screen.getAllByText('Not available').length).toBeGreaterThanOrEqual(4)
        fireEvent.click(screen.getByText('EUR'))
        expect(screen.queryByText(/unlock-modal-open/)).not.toBeInTheDocument()
        expect(
            within(screen.getAllByTestId('closed-row-drawer')[0]).getByText(
                "Bank transfers and card issuing aren't available for residents of your country."
            )
        ).toBeInTheDocument()
        unmount()

        render('payments')
        // Both P2P and crypto are always-on and untouched by a bank/card restriction.
        expect(screen.getAllByText('Always on').length).toBeGreaterThanOrEqual(2)
    })

    // hugo, 2026-09-24: "always show the rails, tell the user why" — Spend too
    it('a Not available Spend row explains why on tap instead of doing nothing', () => {
        mockRestrictions = { banking: false, card: true }
        render('payments')
        fireEvent.click(screen.getByText('Peanut card'))
        expect(screen.getByText("The Peanut card isn't available for residents of your country.")).toBeInTheDocument()
    })

    // Audit C29 (hugo, 2026-09-26): QR is open to every verified user whatever
    // their residence; a banking restriction closes bank transfers only.
    describe('a banking-restricted residence', () => {
        const poolRail = {
            id: 'manteca.pix_br',
            provider: 'manteca',
            channel: 'bank',
            country: 'BR',
            status: 'enabled',
            operations: { pay: 'enabled', deposit: 'requires-info', withdraw: 'requires-info' },
        }

        it('keeps QR payments Available on the QR answer', () => {
            mockRestrictions = { banking: true, card: false }
            mockRails = [poolRail]
            render('payments')
            const qrRow = within(screen.getByText('QR payments').closest('.border') as HTMLElement)
            expect(qrRow.getByText('Available')).toBeInTheDocument()
            expect(qrRow.queryByText('Not available')).not.toBeInTheDocument()
        })

        it('keeps sending to a Pix key on BRL, while the other bank rows close', () => {
            mockUser = { residence: { declared: 'JP', verified: 'JP', declaredSecond: null }, user: { userId: 'u1' } }
            mockRestrictions = { banking: true, card: false }
            mockRails = [poolRail]
            render()
            const brl = within(screen.getByText('BRL').closest('.border') as HTMLElement)
            expect(brl.getByText('Available')).toBeInTheDocument()
            expect(brl.getByText('Send to any Pix key')).toBeInTheDocument()
            expect(
                within(screen.getByText('EUR').closest('.border') as HTMLElement).getByText('Not available')
            ).toBeInTheDocument()
        })

        // Audit C42: a banking-only residence keeps its card, so the note does not claim it
        it('names card issuing in the note only when the residence restricts the card too', () => {
            mockRestrictions = { banking: true, card: false }
            const { unmount } = render()
            expect(
                screen.getByText("Bank transfers aren't available for residents of your country.")
            ).toBeInTheDocument()
            expect(screen.queryByText(/card issuing/)).not.toBeInTheDocument()
            unmount()

            mockRestrictions = { banking: true, card: true }
            render()
            expect(
                screen.getAllByText("Bank transfers and card issuing aren't available for residents of your country.")
                    .length
            ).toBeGreaterThan(0)
        })
    })

    // Audit C53: the Payments row reads the /qr-pay gate, so a user that gate
    // turns away (a region-refused identity with a pool rail left behind)
    // never reads Available here.
    it('QR payments read the /qr-pay answer: a refused identity is not Available', () => {
        mockRegionRestricted = true
        mockRails = [{ id: 'manteca.pix_br', provider: 'manteca', channel: 'bank', country: 'BR', status: 'enabled' }]
        render('payments')
        const qrRow = within(screen.getByText('QR payments').closest('.border') as HTMLElement)
        expect(qrRow.queryByText('Available')).not.toBeInTheDocument()
    })

    // Audit C53: the legacy Bridge-only cohort has no Manteca pay rail, so
    // /qr-pay and Home send it to verification; Payments now says the same.
    it('a Bridge-only user reads the QR offer, as /qr-pay and Home do', () => {
        mockRails = [{ id: 'bridge.ach', provider: 'bridge', channel: 'bank', country: 'US', status: 'enabled' }]
        render('payments')
        const qrRow = within(screen.getByText('QR payments').closest('.border') as HTMLElement)
        expect(qrRow.getByText('Unlock')).toBeInTheDocument()
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

    // support is the escape after a failed start, so it is the tertiary
    // LinkButton under "Try again", not a stroke Button beside it
    it('offers support under the retry as a link, which opens the support sheet', () => {
        mockFlowError = 'Not Found'
        mockUser = { residence: { declared: 'BR', verified: 'BR', pending: 'ES' }, user: { userId: 'u1' } }
        render()
        fireEvent.click(screen.getByLabelText('Change'))
        fireEvent.click(screen.getByText('reverify'))

        const support = screen.getByRole('button', { name: 'Contact support' })
        expect(support).toHaveClass('underline')
        expect(screen.getByRole('button', { name: 'Try again' })).not.toHaveClass('underline')
        fireEvent.click(support)
        expect(mockSetIsSupportModalOpen).toHaveBeenCalledWith(true)
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

    it('states the BRL monthly allowance in the row drawer, never as a card on the screen', () => {
        mockRails = [{ id: 'manteca.bank', provider: 'manteca', channel: 'bank', country: 'BR', status: 'enabled' }]
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
        // Limits are one tap down, not a standing card above the fold.
        expect(screen.queryByText(/left this month/)).not.toBeInTheDocument()

        fireEvent.click(screen.getByText('BRL'))
        expect(within(screen.getByRole('dialog')).getByText(/left this month/)).toBeInTheDocument()
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

            expect(screen.getByText('Other ways to move money with Peanut')).toBeInTheDocument()
            expect(
                screen.getByText('These also add and withdraw money. They are not accounts in your name.')
            ).toBeInTheDocument()
            expect(screen.queryByTestId('virtual-accounts')).not.toBeInTheDocument()
            expect(screen.getAllByText('Unlock').length).toBeGreaterThan(0)
            // the word that meant two things is gone from the vocabulary
            expect(screen.queryByText('Active')).not.toBeInTheDocument()
        })

        it('rail only: the row reads Available, and still no account numbers section', () => {
            mockRails = [{ id: 'bridge.ach', provider: 'bridge', channel: 'bank', country: 'US', status: 'enabled' }]
            render()

            expect(screen.getAllByText('Available').length).toBeGreaterThan(0)
            expect(screen.queryByText('Active')).not.toBeInTheDocument()
            expect(screen.queryByTestId('virtual-accounts')).not.toBeInTheDocument()
        })

        /*
         * A corridor the user could open is not one they hold: it sits under
         * "Open new account", the list Add money shows too (QA-18), and
         * the tap goes to the claim step there.
         */
        it('rail and an account they could open: offered under its own heading, never as held', () => {
            mockDepositEnabled = true
            mockRails = [{ id: 'bridge.ach', provider: 'bridge', channel: 'bank', country: 'US', status: 'enabled' }]
            mockDepositAccounts = {}
            mockDepositCorridors = ['ACH_US']
            render()

            expect(screen.queryByTestId('virtual-accounts')).not.toBeInTheDocument()
            expect(screen.getByText('Open new account')).toBeInTheDocument()
            fireEvent.click(screen.getByTestId('deposit-account-ACH_US'))
            expect(mockPush).toHaveBeenCalledWith(
                '/add-money?method=bank&step=claim&corridor=ACH_US&returnTo=%2Fprofile%2Faccounts'
            )
        })

        it('an account held: it gets its own section, its own words, and Ready', () => {
            mockDepositEnabled = true
            mockRails = [{ id: 'bridge.sepa', provider: 'bridge', channel: 'bank', country: 'EU', status: 'enabled' }]
            mockDepositAccounts = {
                SEPA_EU: { status: 'active', instructions: {}, matching: { sender: 'anyone' } },
            }
            render()

            const held = screen.getByTestId('virtual-accounts')
            // the heading, the counter and its reason share the section's top row
            // (hugo, 2026-09-25: the heading stays, beside the counter)
            const heading = within(held).getByRole('heading', { name: 'Accounts' })
            const counter = within(held).getByTestId('account-counter')
            expect(counter).toHaveTextContent('1 of 2 used')
            expect(heading.parentElement).toBe(counter.parentElement)
            expect(within(held).getByLabelText('Why a limit?')).toBeInTheDocument()
            // a payer can be handed these details; rail access never says Ready
            expect(screen.getByText('Ready')).toBeInTheDocument()
            expect(screen.queryByText('Active')).not.toBeInTheDocument()
        })
    })

    // the same fold Add money shows, from the one shared list
    it('folds the accounts still to open under a held one, as Add money does', () => {
        mockDepositEnabled = true
        mockRails = [{ id: 'bridge.sepa', provider: 'bridge', channel: 'bank', country: 'EU', status: 'enabled' }]
        mockDepositAccounts = { SEPA_EU: { status: 'active', instructions: {}, matching: { sender: 'anyone' } } }
        mockDepositCorridors = ['SEPA_EU', 'ACH_US']
        render()

        expect(screen.getByTestId('open-accounts-toggle')).toHaveTextContent('Open new account')
        expect(screen.queryByTestId('deposit-account-ACH_US')).not.toBeInTheDocument()
        fireEvent.click(screen.getByTestId('open-accounts-toggle'))
        fireEvent.click(screen.getByTestId('deposit-account-ACH_US'))
        expect(mockPush).toHaveBeenCalledWith(
            '/add-money?method=bank&step=claim&corridor=ACH_US&returnTo=%2Fprofile%2Faccounts'
        )
    })

    it('names the deposit and withdrawal caps separately, inside the row drawer', () => {
        mockRails = [{ id: 'bridge.ach', provider: 'bridge', channel: 'bank', country: 'US', status: 'enabled' }]
        mockBridgeLimits = { onRampPerTransaction: '25000', offRampPerTransaction: '50000', asset: 'USD' }
        render()
        expect(screen.queryByText('Per bank deposit')).not.toBeInTheDocument()
        expect(screen.queryByText('Per bank withdrawal')).not.toBeInTheDocument()

        fireEvent.click(screen.getByText('USD'))
        const drawer = screen.getByRole('dialog')
        expect(within(drawer).getByText('Per bank deposit')).toBeInTheDocument()
        expect(within(drawer).getByText('Per bank withdrawal')).toBeInTheDocument()
        expect(within(drawer).getByText('$25,000')).toBeInTheDocument()
        expect(within(drawer).getByText('$50,000')).toBeInTheDocument()
    })

    it('active payment rows explain the method in a drawer', () => {
        render('payments')
        fireEvent.click(screen.getByText('Peanut-to-Peanut payments'))

        const drawer = screen.getByRole('dialog')
        expect(within(drawer).getByText('Send and receive money with other Peanut users.')).toBeInTheDocument()
        expect(within(drawer).getByText('No amount limits on Peanut-to-Peanut payments or crypto')).toBeInTheDocument()
        expect(mockInitiateKyc).not.toHaveBeenCalled()
    })

    it('held bank accounts reuse account details, retain the profile return path, and drop the duplicate active row', () => {
        mockDepositEnabled = true
        mockRails = [{ id: 'bridge.sepa', provider: 'bridge', channel: 'bank', country: 'EU', status: 'enabled' }]
        mockDepositAccounts = {
            SEPA_EU: { status: 'active', instructions: {}, matching: { sender: 'business-only' } },
        }
        render()

        // The two pathways are named apart: the account the user holds sits
        // under its own heading, and the corridors their verification opens sit
        // under the other. One list called "Your accounts" said both were the
        // same thing, under a subtitle promising account numbers to share.
        expect(screen.getByTestId('virtual-accounts')).toBeInTheDocument()
        expect(screen.getByText('Other ways to move money with Peanut')).toBeInTheDocument()
        fireEvent.click(screen.getByText('EUR'))
        expect(mockPush).toHaveBeenCalledWith(
            '/add-money?method=bank&step=details&corridor=SEPA_EU&returnTo=%2Fprofile%2Faccounts'
        )
        // An active EUR account covers the same corridor as the active "Euro
        // bank transfers" row (2026-09-18 currency-first merge) — the merged
        // list shows it once, not twice.
        expect(screen.getAllByText('EUR')).toHaveLength(1)
    })

    it('holds the bank rows behind skeletons until the accounts load, so the deduped list does not jump', () => {
        mockDepositEnabled = true
        mockReadDepositAccounts.mockReturnValueOnce({
            corridors: [],
            claimable: {},
            unavailable: {},
            slotsHeld: 0,
            accountLimit: 2,
            accounts: {},
            gates: mockGates(),
            isLoading: true,
            isError: false,
            refetch: jest.fn(),
        })
        render()

        expect(screen.getByText('Other ways to move money with Peanut')).toBeInTheDocument()
        expect(screen.queryByText('EUR')).not.toBeInTheDocument()
        expect(screen.queryByText('USD')).not.toBeInTheDocument()
    })

    it('keeps the bank row when the account cannot stand in for it', () => {
        mockDepositEnabled = true
        // a revoked account covers nothing, and the row is the only way into
        // the unlock or fix modal for that rail
        mockDepositAccounts = {
            SEPA_EU: { status: 'revoked', instructions: {}, matching: { sender: 'business-only' } },
        }
        render()

        // one title for the held account row, one for the bank row
        expect(screen.getAllByText('EUR')).toHaveLength(2)
    })

    /**
     * Hugo, 2026-09-21 QA: limits were three standing cards on a screen whose
     * job is naming the corridors. They are not top-level items — every one of
     * them is already stated in the drawer a tap away, from the same data.
     */
    it('renders no limit card anywhere on the screen', () => {
        mockDepositEnabled = true
        mockRails = [
            { id: 'bridge.ach', provider: 'bridge', channel: 'bank', country: 'US', status: 'enabled' },
            { id: 'manteca.bank', provider: 'manteca', channel: 'bank', country: 'BR', status: 'enabled' },
        ]
        mockBridgeLimits = { onRampPerTransaction: '25000', offRampPerTransaction: '50000', asset: 'USD' }
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
        for (const page of ['accounts', 'payments'] as const) {
            const { unmount } = render(page)
            expect(screen.queryByText('Per bank deposit')).not.toBeInTheDocument()
            expect(screen.queryByText('Per bank withdrawal')).not.toBeInTheDocument()
            expect(screen.queryByText(/left this month/)).not.toBeInTheDocument()
            expect(
                screen.queryByText('No amount limits on Peanut-to-Peanut payments or crypto')
            ).not.toBeInTheDocument()
            unmount()
        }
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
        // the bank rows, not the accounts to open above them
        const otherWays = within(screen.getByTestId('other-ways'))
        const rows = ['EUR', 'USD'].map((title) => otherWays.getByText(title).closest('.border'))
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
        expect(screen.getByText('Other ways to move money with Peanut')).toBeInTheDocument()
        expect(screen.queryByTestId('virtual-accounts')).not.toBeInTheDocument()
        expect(screen.getByText('EUR')).toBeInTheDocument()
    })

    it('states the P2P no-limit fact in the crypto drawer too, never on the screen', () => {
        render('payments')
        expect(screen.queryByText('No amount limits on Peanut-to-Peanut payments or crypto')).not.toBeInTheDocument()

        fireEvent.click(screen.getByText('Crypto'))
        expect(
            within(screen.getByRole('dialog')).getByText('No amount limits on Peanut-to-Peanut payments or crypto')
        ).toBeInTheDocument()
    })

    // A residence-parked rail. The TOP-LEVEL status is `blocked` (the backend maps
    // REQUIRES_SUPPORT that way); only `resolved.status` is fixable. That is what
    // makes `hasFunctionalRail` treat the region as LOCKED, so this modal is the
    // surface the cohort actually reaches (TASK-22286).
    const residenceParkedRail = {
        id: 'bridge.sepa_eu',
        provider: 'bridge',
        channel: 'bank',
        country: 'EU',
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
        fireEvent.click(screen.getByText('EUR'))
        fireEvent.click(screen.getByText('Upload document'))

        expect(mockFixableRejection).toHaveBeenCalledWith(
            expect.objectContaining({ provider: 'BRIDGE', reasonCode: 'residence_unresolved' })
        )
        expect(mockSelfHealResubmit).not.toHaveBeenCalled()
    })

    it('every other fixable rejection here still takes resubmit — Manteca is untouched', () => {
        mockUser = { residence: { declared: 'BR', verified: 'BR', declaredSecond: null }, user: { userId: 'u1' } }
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
        fireEvent.click(screen.getByText('BRL'))
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
            mockUser = { residence: { declared: 'BR', verified: 'BR', declaredSecond: null }, user: { userId: 'u1' } }
            mockRails = [qrPoolRail]
            mockIsKycApproved = true
            const { unmount } = render()

            const bankRow = screen.getByText('BRL')
            expect(within(bankRow.closest('.border') as HTMLElement).getByText('Unlock')).toBeInTheDocument()
            // the row is the way into the onboarding that makes it true
            fireEvent.click(bankRow)
            expect(screen.getByText('unlock-modal-open:BRL · Pix')).toBeInTheDocument()
            unmount()

            render('payments')
            const qrRow = screen.getByText('QR payments')
            expect(within(qrRow.closest('.border') as HTMLElement).getByText('Available')).toBeInTheDocument()
        })

        it('a full Manteca account reads Available on both rows', () => {
            mockUser = { residence: { declared: 'BR', verified: 'BR', declaredSecond: null }, user: { userId: 'u1' } }
            mockRails = [{ ...qrPoolRail, operations: { pay: 'enabled', deposit: 'enabled', withdraw: 'enabled' } }]
            mockIsKycApproved = true
            const { unmount } = render()

            const bankRow = screen.getByText('BRL')
            expect(within(bankRow.closest('.border') as HTMLElement).getByText('Available')).toBeInTheDocument()
            unmount()

            render('payments')
            const qrRow = screen.getByText('QR payments')
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

            const row = screen.getByText('USD').closest('.border') as HTMLElement
            expect(within(row).queryByText('Available')).not.toBeInTheDocument()
            expect(within(row).getByText('Processing')).toBeInTheDocument()
        })
    })

    /**
     * One row per currency (ruled 2026-09-21, hugo — "prob makes sense to split
     * usa and Mexico"). A merged row gave two currencies one chip, so a user
     * with a working US rail and no Mexican one read "Available" on a row that
     * named MXN. Each chip is now scoped to its own corridor's country.
     */
    describe('one row per currency', () => {
        const badgeFor = (title: string) => within(screen.getByText(title).closest('.border') as HTMLElement)

        it('names each currency on its own row, in its own group', () => {
            // a dual resident, so both Manteca rows are offered and no residence note shows
            mockUser = { residence: { declared: 'BR', verified: 'BR', declaredSecond: 'AR' }, user: { userId: 'u1' } }
            render()
            for (const title of ['BRL', 'ARS', 'USD', 'MXN']) {
                expect(screen.getByText(title)).toBeInTheDocument()
            }
            expect(screen.queryByText(/USD and MXN/)).not.toBeInTheDocument()
            expect(screen.queryByText(/BRL and ARS/)).not.toBeInTheDocument()
        })

        it('a US-only Bridge rail says Available on USD and never on MXN', () => {
            mockRails = [{ id: 'bridge.ach', provider: 'bridge', channel: 'bank', country: 'US', status: 'enabled' }]
            render()

            expect(badgeFor('USD').getByText('Available')).toBeInTheDocument()
            expect(badgeFor('MXN').queryByText('Available')).not.toBeInTheDocument()
            expect(badgeFor('MXN').getByText('Unlock')).toBeInTheDocument()
        })

        // Konrad, 2026-09-23: "Unlock" is a DS badge in the neutral status,
        // never a pill style of its own and never the accent colour.
        it('draws Unlock as a neutral badge', () => {
            mockRails = [{ id: 'bridge.ach', provider: 'bridge', channel: 'bank', country: 'US', status: 'enabled' }]
            render()

            const unlock = badgeFor('MXN').getByText('Unlock')
            expect(unlock).toHaveClass('bg-background-badge-helper')
            expect(unlock).not.toHaveClass('bg-background-badge-accent')
        })

        it('a Brazil-only Manteca rail says Available on BRL and never on ARS', () => {
            mockRails = [
                { id: 'manteca.pix_br', provider: 'manteca', channel: 'bank', country: 'BR', status: 'enabled' },
            ]
            render()

            expect(badgeFor('BRL').getByText('Available')).toBeInTheDocument()
            expect(badgeFor('ARS').queryByText('Available')).not.toBeInTheDocument()
        })

        it('sibling rows still route into the one verification that opens both', () => {
            render()
            fireEvent.click(screen.getByText('MXN'))
            expect(screen.getByText('unlock-modal-open:MXN · SPEI')).toBeInTheDocument()
        })

        it("a usable row opens that currency's own details drawer", () => {
            mockRails = [{ id: 'bridge.ach', provider: 'bridge', channel: 'bank', country: 'US', status: 'enabled' }]
            render()

            fireEvent.click(screen.getByText('USD'))
            const drawer = screen.getByRole('dialog')
            expect(within(drawer).getByText('Add and withdraw dollars using US bank transfers.')).toBeInTheDocument()
            expect(within(drawer).queryByText(/Mexican pesos/)).not.toBeInTheDocument()
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
            render('payments')

            expect(screen.getByText('Spend')).toBeInTheDocument()
            expect(screen.getByText('Peanut card')).toBeInTheDocument()
            expect(screen.getByText('QR payments')).toBeInTheDocument()
            // the title used to carry the corridor and wrapped over three
            // lines at 375px; the description names it in one (Slava, 2026-09-25)
            expect(screen.getByText('Brazil and Argentina')).toBeInTheDocument()

            // no Manteca rail yet: the row is the same unlock offer the bank
            // row is, and the tap opens the same region intent
            fireEvent.click(screen.getByText('QR payments'))
            expect(screen.getByText('unlock-modal-open:QR payments')).toBeInTheDocument()
            expect(mockPush).not.toHaveBeenCalled()
        })

        // QA 2026-09-25: an Available QR row drew a green status bubble while
        // the bottom nav drew QR pink. The bubble is the concept; the badge is the status.
        it.each([
            ['locked', []],
            [
                'available',
                [{ id: 'manteca.bank', provider: 'manteca', channel: 'bank', country: 'BR', status: 'enabled' }],
            ],
        ])('draws each row with its concept bubble while %s', (_state, rails: unknown[]) => {
            mockRails = rails
            render('payments')

            const bubbleOf = (title: string) =>
                (screen.getByText(title).closest('.border') as HTMLElement).querySelector('.rounded-full')
            expect(bubbleOf('Peanut card')).toHaveClass('bg-background-icon-bubble-yellow')
            expect(bubbleOf('Crypto')).toHaveClass('bg-background-icon-bubble-blue')
        })

        // TASK-23054 (hugo): the QR row leads with the flags of the two
        // countries it pays in, overlapped, instead of the QR bubble; the
        // title and the "Brazil and Argentina" line stay.
        it('leads QR payments with the Brazilian and Argentine flags, and lists no Pix key row', () => {
            render('payments')

            const qrRow = screen.getByText('QR payments').closest('.border') as HTMLElement
            const flags = Array.from(qrRow.querySelectorAll('img'), (img) => img.getAttribute('src'))
            expect(flags).toEqual(['/flags/br.svg', '/flags/ar.svg'])
            expect(qrRow.querySelector('.bg-background-brand')).toBeNull()
            expect(within(qrRow).getByText('Brazil and Argentina')).toBeInTheDocument()

            expect(screen.queryByText('Pix key payments')).not.toBeInTheDocument()
            expect(screen.queryByText('Any Pix key in Brazil')).not.toBeInTheDocument()
        })

        it('reads Available once the QR rail is live, and explains itself in the drawer', () => {
            mockRails = [{ id: 'manteca.bank', provider: 'manteca', channel: 'bank', country: 'BR', status: 'enabled' }]
            render('payments')

            const qrRow = screen.getByText('QR payments')
            fireEvent.click(qrRow)
            const drawer = screen.getByRole('dialog')
            expect(
                within(drawer).getByText('Pay in shops in Brazil and Argentina by scanning a QR code.')
            ).toBeInTheDocument()
            expect(mockInitiateKyc).not.toHaveBeenCalled()
        })

        it('the bank list never mentions QR any more', () => {
            render()

            const bankRow = screen.getByText('BRL')
            expect(bankRow.textContent).not.toMatch(/QR/)
        })
    })

    /**
     * TASK-23054 (hugo): the Pix key row left Payments. Outside Brazil the BRL
     * row is the Pix send (`withPixSend`); a Brazilian resident's BRL row stays
     * their bank rail, and its drawer carries the send on the same capability.
     */
    describe('a Brazilian resident sends to a Pix key from the BRL drawer', () => {
        const brazilianRail = (pay: 'enabled' | 'requires-info') => ({
            id: 'manteca.pix_br',
            provider: 'manteca',
            channel: 'bank',
            country: 'BR',
            status: 'enabled',
            operations: { pay, deposit: 'enabled', withdraw: 'enabled' },
        })
        const openBrlDrawer = () => {
            fireEvent.click(screen.getByText('BRL'))
            return within(screen.getByRole('dialog'))
        }

        beforeEach(() => {
            mockUser = { residence: { declared: 'BR', verified: 'BR' }, user: { userId: 'u1' } }
            mockIsKycApproved = true
        })

        it('with the pay capability, the drawer links to Pix key sending and the row keeps its bank status', () => {
            mockRails = [brazilianRail('enabled')]
            render()

            const row = within(screen.getByText('BRL').closest('.border') as HTMLElement)
            expect(row.getByText('Available')).toBeInTheDocument()
            expect(row.queryByText('Send to any Pix key')).not.toBeInTheDocument()

            const drawer = openBrlDrawer()
            expect(drawer.getByText('Add and withdraw Brazilian reais with Pix.')).toBeInTheDocument()
            expect(drawer.getByRole('link', { name: 'Send to any Pix key' })).toHaveAttribute(
                'href',
                '/withdraw/manteca?method=pix&country=brazil'
            )
            expect(mockPush).not.toHaveBeenCalled()
        })

        it('without it, the drawer offers no Pix send', () => {
            mockRails = [brazilianRail('requires-info')]
            render()

            const drawer = openBrlDrawer()
            expect(drawer.getByText('Add and withdraw Brazilian reais with Pix.')).toBeInTheDocument()
            expect(drawer.queryByText('Send to any Pix key')).not.toBeInTheDocument()
        })

        it('outside Brazil the row itself is the Pix send, and opens no drawer', () => {
            mockUser = { residence: { declared: 'PT', verified: 'PT', declaredSecond: null }, user: { userId: 'u1' } }
            mockRails = [
                {
                    ...brazilianRail('enabled'),
                    operations: { pay: 'enabled', deposit: 'requires-info', withdraw: 'requires-info' },
                },
            ]
            render()

            fireEvent.click(screen.getByText('BRL'))
            expect(mockPush).toHaveBeenCalledWith('/withdraw/manteca?method=pix&country=brazil')
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
    })

    it('a pending residence verification is surfaced without replacing the active country', () => {
        mockUser = { residence: { declared: 'BR', verified: 'BR', pending: 'ES' }, user: { userId: 'u1' } }
        render()
        expect(screen.getByText('Change to Spain pending verification')).toBeInTheDocument()
    })
})

/**
 * The awaiting-action ghost (2026-09-22). A user who started the Argentine
 * verification, left, and later verified elsewhere keeps a PENDING Argentine
 * rail that only the Argentine action could clear. The modal used to pick the
 * first non-final Manteca rail whatever the row, so the Brazilian row opened
 * "Setting up your account…" forever (189 users in prod). The modal now reads
 * the rails of the tapped row's own country — the same scope its chip uses.
 */
describe("a row's modal reads the rails of its own country", () => {
    const argentineGhost = {
        id: 'manteca.bank_transfer_ar',
        provider: 'manteca',
        channel: 'bank',
        country: 'AR',
        currency: 'ARS',
        status: 'pending',
        pendingSince: '2026-08-01T00:00:00.000Z',
    }
    const dualResident = () => {
        mockUser = { residence: { declared: 'BR', verified: 'BR', declaredSecond: 'AR' }, user: { userId: 'u1' } }
        mockIsKycApproved = true
        mockRails = [argentineGhost]
    }

    it('the Brazilian row offers the unlock; the Argentine ghost is not its story', () => {
        dualResident()
        render()
        fireEvent.click(screen.getByText('BRL'))
        expect(screen.getByText('unlock-modal-open:BRL · Pix')).toBeInTheDocument()
        expect(screen.queryByText(/processing-modal-open/)).not.toBeInTheDocument()
    })

    it('the Argentine row still owns its pending rail, and hands the drawer when it went pending', () => {
        dualResident()
        render()
        fireEvent.click(screen.getByText('ARS'))
        expect(screen.getByText('processing-modal-open:2026-08-01T00:00:00.000Z')).toBeInTheDocument()
        expect(screen.queryByText(/unlock-modal-open/)).not.toBeInTheDocument()
    })

    it("a Manteca tap names the row's country, so the backend starts that flow and not a residence guess", () => {
        dualResident()
        mockRails = []
        render()
        fireEvent.click(screen.getByText('ARS'))
        fireEvent.click(screen.getByText('unlock now'))
        expect(mockInitiateKyc).toHaveBeenCalledWith('LATAM', undefined, true, 'AR')

        fireEvent.click(screen.getByText('EUR'))
        fireEvent.click(screen.getByText('unlock now'))
        // the backend refuses any non-Manteca target country, so Bridge rows send none
        expect(mockInitiateKyc).toHaveBeenLastCalledWith('EU', undefined, true, undefined)
    })
})

/**
 * The Manteca corridors are for legal residents of Brazil and Argentina: the
 * Argentine account opens to residents alone, and the Brazilian one needs a CPF,
 * checked here through a Brazilian residence (a client-side pre-check). A
 * Portuguese resident was offered "BRL · Pix",
 * tapped it, and met the Argentine ghost's drawer; now the ARS row is not
 * offered, and says why. Sending to a Pix key is open to every verified user
 * (hugo, QA-12), so the BRL row speaks for sending instead.
 */
describe('a resident of neither country is not offered the Manteca bank rows', () => {
    const badgeFor = (title: string) => within(screen.getByText(title).closest('.border') as HTMLElement)

    it('ARS reads Not available, sorts last and says which residence it needs; BRL offers sending', () => {
        mockUser = { residence: { declared: 'PT', verified: 'PT', declaredSecond: null }, user: { userId: 'u1' } }
        mockIsKycApproved = true
        mockRails = [
            { id: 'manteca.bank_transfer_ar', provider: 'manteca', channel: 'bank', country: 'AR', status: 'pending' },
        ]
        render()

        expect(badgeFor('BRL').getByText('Unlock')).toBeInTheDocument()
        expect(badgeFor('BRL').getByText('Send to any Pix key')).toBeInTheDocument()
        expect(badgeFor('ARS').getByText('Not available')).toBeInTheDocument()
        // the same neutral pill as the card's "Not available" (Konrad, 2026-09-23)
        expect(badgeFor('ARS').getByText('Not available')).toHaveClass('bg-background-badge-helper')
        expect(badgeFor('ARS').queryByText('Processing')).not.toBeInTheDocument()
        // the rows explain themselves, so no note under the list repeats it
        expect(screen.queryByText(/residents of Brazil and Argentina/)).not.toBeInTheDocument()
        const rows = Array.from(
            screen.getByTestId('other-ways').querySelectorAll('[data-testid^="bank-row-"]'),
            (row) => row.getAttribute('data-testid')
        )
        expect(rows.slice(-1)).toEqual(['bank-row-ars'])
        // the Bridge rows keep their offer, and so does QR — it needs no account
        expect(badgeFor('EUR').getByText('Unlock')).toBeInTheDocument()

        fireEvent.click(screen.getByText('ARS'))
        expect(screen.queryByText(/unlock-modal-open/)).not.toBeInTheDocument()
        expect(screen.queryByText(/processing-modal-open/)).not.toBeInTheDocument()
        const drawer = within(screen.getByTestId('closed-row-drawer'))
        expect(drawer.getByText(/Only legal residents of Argentina/)).toBeInTheDocument()

        // the way to change the residence is this screen's own drawer
        jest.useFakeTimers()
        fireEvent.click(drawer.getByRole('button', { name: 'Update residence' }))
        act(() => jest.runAllTimers())
        jest.useRealTimers()
        expect(screen.getByText('change-modal-open')).toBeInTheDocument()
    })

    // QR needs no account, so it keeps its offer on Payments
    it('keeps the QR payments offer on Payments', () => {
        mockUser = { residence: { declared: 'PT', verified: 'PT', declaredSecond: null }, user: { userId: 'u1' } }
        mockIsKycApproved = true
        render('payments')
        expect(badgeFor('QR payments').getByText('Unlock')).toBeInTheDocument()
    })

    it('a verified non-resident who can pay by Pix reads Available on BRL, and the tap opens Pix key sending', () => {
        mockUser = { residence: { declared: 'PT', verified: 'PT', declaredSecond: null }, user: { userId: 'u1' } }
        mockIsKycApproved = true
        // pool tier: paying is open, adding and own-account withdraw are not
        mockRails = [
            {
                id: 'manteca.pix_br',
                provider: 'manteca',
                channel: 'bank',
                country: 'BR',
                status: 'enabled',
                operations: { pay: 'enabled', deposit: 'requires-info', withdraw: 'requires-info' },
            },
        ]
        render()

        expect(badgeFor('BRL').getByText('Available')).toBeInTheDocument()
        fireEvent.click(screen.getByText('BRL'))
        expect(mockPush).toHaveBeenCalledWith('/withdraw/manteca?method=pix&country=brazil')
    })

    // Chip review on ui#3400, kept when the Pix key row left Payments
    // (TASK-23054): the Bridge-only cohort pays by QR through the region
    // fallback, but /qr-pay gates on the Manteca pay capability, so the BRL
    // row must not link them into key entry.
    it('a Bridge-only non-resident gets the Pix offer on BRL, never a link', () => {
        mockUser = { residence: { declared: 'PT', verified: 'PT', declaredSecond: null }, user: { userId: 'u1' } }
        mockIsKycApproved = true
        mockRails = [{ id: 'bridge.ach', provider: 'bridge', channel: 'bank', country: 'US', status: 'enabled' }]
        render()

        expect(badgeFor('BRL').queryByText('Available')).not.toBeInTheDocument()
        expect(badgeFor('BRL').getByText('Send to any Pix key')).toBeInTheDocument()
        // this describe has no beforeEach of its own, so earlier taps would still count
        mockPush.mockClear()
        fireEvent.click(screen.getByText('BRL'))
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('a Brazilian rail that already works stays Available after a move', () => {
        mockUser = { residence: { declared: 'PT', verified: 'PT', declaredSecond: null }, user: { userId: 'u1' } }
        mockIsKycApproved = true
        mockRails = [
            {
                id: 'manteca.pix_br',
                provider: 'manteca',
                channel: 'bank',
                country: 'BR',
                status: 'enabled',
                operations: { pay: 'enabled', deposit: 'enabled', withdraw: 'enabled' },
            },
        ]
        render()

        expect(badgeFor('BRL').getByText('Available')).toBeInTheDocument()
        expect(badgeFor('ARS').getByText('Not available')).toBeInTheDocument()
    })
})

import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import esMessages from '@/i18n/app/messages/es-419.json'
import ptMessages from '@/i18n/app/messages/pt-BR.json'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { DepositAccountsFlow } from '../components/DepositAccountsFlow'
import { DepositAccountsListScreen } from '../components/DepositAccountsListScreen'
import { corridorRecord, DEPOSIT_RAIL_ORDER, emptyCorridorRecord } from '../rails'
import { holdsSlot } from '../resolveScreen'
import type { ClaimableCorridor, DepositAccount, DepositCorridor, UnavailableCorridor } from '../types'
import type { GateState } from '@/utils/capability-gate'
import { withReturnTo } from '@/utils/return-to.utils'

/** the hub the Manteca top-up returns to — the origin every top-up push carries */
const HUB_RETURN = '/add-money?method=bank'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const mockPush = jest.fn()
// The hub renders the app chrome around the accounts now (NavHeader, the
// banner), and that chrome reads the route — so the mock answers the whole
// navigation surface, not just the push the rows needed.
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/add-money',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
}))

// the country list is covered by its own tests; here it only has to hand a
// country back to the screen the way a tap does
jest.mock('@/components/Common/CountryList', () => ({
    CountryList: (props: any) => (
        <div data-testid="country-list" data-own-search={String(props.searchTerm === undefined)}>
            <span>{props.inputTitle}</span>
            <button
                data-testid="country-germany"
                data-supported={String(props.isCountrySupported({ type: 'country', iso2: 'DE', currency: 'EUR' }))}
                onClick={() => props.onCountryClick({ type: 'country', iso2: 'DE', currency: 'EUR', path: 'germany' })}
            >
                Germany
            </button>
        </div>
    ),
}))

const mockOpenCountry = jest.fn()
const mockIsCountrySupported = jest.fn(() => true)
jest.mock('../useDepositCountryRouting', () => ({
    useDepositCountryRouting: () => ({
        openCountry: mockOpenCountry,
        isCountrySupported: mockIsCountrySupported,
    }),
}))

// the Flow reads the user's residence; the hub does not
let residenceIso2s: string[] = []
jest.mock('../useResidenceIso2s', () => ({ useResidenceIso2s: () => residenceIso2s }))

let depositAccountsEnabled = true
jest.mock('../useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => depositAccountsEnabled,
}))

beforeEach(() => {
    jest.clearAllMocks()
    depositAccountsEnabled = true
    residenceIso2s = []
    mockIsCountrySupported.mockReturnValue(true)
})

const READY: GateState = { kind: 'ready' }

/** one gate for every corridor, the way a user with every rail enabled looks */
const allGates = (gate: GateState = READY): Record<DepositCorridor, GateState> => corridorRecord(() => gate)

const NONE = emptyCorridorRecord<DepositAccount>()

/** a corridor the user already holds, active and receiving money */
const heldAccount = (corridor: DepositCorridor): DepositAccount => ({
    id: `acct-${corridor}`,
    railId: `bridge.${corridor.toLowerCase()}`,
    country: 'DE',
    currency: 'EUR',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: 'anyone' },
    instructions: { accountHolderName: 'Ana Pérez', iban: 'DE00', paymentRails: ['sepa'] },
})

const list = (
    isLoading: boolean,
    opts: {
        corridors?: DepositCorridor[]
        gates?: Record<DepositCorridor, GateState>
        isError?: boolean
        accounts?: Record<DepositCorridor, DepositAccount | undefined>
        /** the corridors the backend offers, with the block it put on each */
        claimable?: Partial<Record<DepositCorridor, ClaimableCorridor>>
        /** the corridors the backend withholds, with the reason for each */
        unavailable?: Partial<Record<DepositCorridor, UnavailableCorridor>>
        /** defaults to what the accounts imply; set it to stand for a rotation */
        slotsHeld?: number
        /** the user's own limit, as the backend sends it */
        accountLimit?: number
        onOpen?: (corridor: DepositCorridor) => void
        /** the hub reads `?method=` to decide whether crypto is still a question */
        searchParams?: string
    } = {}
) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <NuqsTestingAdapter searchParams={opts.searchParams ?? ''}>
                <DepositAccountsListScreen
                    corridors={opts.corridors ?? DEPOSIT_RAIL_ORDER}
                    accounts={opts.accounts ?? NONE}
                    claimable={{ ...emptyCorridorRecord<ClaimableCorridor>(), ...opts.claimable }}
                    unavailable={{ ...emptyCorridorRecord<UnavailableCorridor>(), ...opts.unavailable }}
                    slotsHeld={opts.slotsHeld ?? Object.values(opts.accounts ?? NONE).filter(holdsSlot).length}
                    accountLimit={opts.accountLimit}
                    gates={opts.gates ?? allGates()}
                    isLoading={isLoading}
                    isError={opts.isError ?? false}
                    onBack={() => {}}
                    onOpen={opts.onOpen ?? (() => {})}
                    onRetry={() => {}}
                />
            </NuqsTestingAdapter>
        </NextIntlClientProvider>
    )

/** a corridor the backend withholds from this user, and why */
const withheld = (corridor: DepositCorridor, reason: UnavailableCorridor['reason']): UnavailableCorridor => ({
    railId: `bridge.${corridor.toLowerCase()}`,
    method: corridor,
    country: 'CO',
    currency: 'COP',
    reason,
})

/** a corridor the backend offers this user, with the block it carries, if any */
const offered = (corridor: DepositCorridor, blockedBy?: ClaimableCorridor['blockedBy']): ClaimableCorridor => ({
    railId: `bridge.${corridor.toLowerCase()}`,
    method: corridor,
    country: 'CO',
    currency: 'COP',
    matching: { sender: 'unknown' },
    ...(blockedBy ? { blockedBy } : {}),
})

const rowOf = (container: HTMLElement, corridor: DepositCorridor) =>
    container.querySelector(`[data-testid="deposit-account-${corridor}"]`)

const inRow = (container: HTMLElement, corridor: DepositCorridor) => within(rowOf(container, corridor) as HTMLElement)

/** the countries toggle row, collapsed until tapped */
const countriesTrigger = () => screen.getByTestId('other-countries-toggle')

/**
 * The corridors are a local catalogue and the accounts are a network call, so
 * the rows paint before anything is known about them. What the screen says in
 * that gap has to be true, because the alternative is a wrong status that
 * corrects itself a moment later.
 */
describe('DepositAccountsListScreen', () => {
    it('claims nothing about a corridor while the accounts are still loading', () => {
        list(true)
        expect(screen.queryByText(/not set up/i)).not.toBeInTheDocument()
    })

    /**
     * What a real unverified user gets. Their rails come back `requires-info`
     * with a `sumsub:identity` action on them, and the gate resolver answers
     * `fixable-rejection` — NOT `needs-identity`, which is its answer for "no
     * functional rail in scope". The rows only ever asked about
     * `needs-identity`, so four corridors read "Not set up" on a DISABLED row,
     * while the screen behind them was ready to say "Verify your identity
     * first" and open the flow that clears it. Both halves were wrong: the
     * user can set one up, and the row refused the tap that starts it.
     *
     * Found by the browser smoke of the `get-paid-blocked` fixture, whose rail
     * shape is the backend's own.
     */
    describe('a corridor blocked only by verification', () => {
        const unverified = (kind: GateState['kind']) => {
            const gates = allGates({ kind, userMessage: null } as GateState)
            return list(false, { corridors: ['SEPA_EU'], gates })
        }

        it.each([['fixable-rejection'], ['restart-identity'], ['needs-identity']] as const)(
            'says verification is what is needed when the gate reads %s',
            (kind) => {
                const { container } = unverified(kind)

                expect(inRow(container, 'SEPA_EU').getByText('Requires verification')).toBeInTheDocument()
                expect(inRow(container, 'SEPA_EU').queryByText('Not set up')).not.toBeInTheDocument()
            }
        )

        it.each([['fixable-rejection'], ['restart-identity']] as const)(
            'keeps the row tappable into the verification flow when the gate reads %s',
            (kind) => {
                const { container } = unverified(kind)

                expect(rowOf(container, 'SEPA_EU')).not.toHaveAttribute('aria-disabled', 'true')
            }
        )

        /*
         * The line that must not move. `needs-enrollment` means the user is
         * already verified and has no rail for this corridor, so verifying
         * again cannot open it — and one enabled Manteca rail must not unlock
         * four Bridge corridors. That row stays closed.
         */
        it('leaves a verified user with no rail closed, and does not offer verification', () => {
            const { container } = unverified('needs-enrollment')

            expect(rowOf(container, 'SEPA_EU')).toHaveAttribute('aria-disabled', 'true')
            expect(inRow(container, 'SEPA_EU').queryByText('Requires verification')).not.toBeInTheDocument()
        })
    })

    /**
     * One rail, one answer, whatever screen you read it on. Accounts & payments
     * badges the Argentine rail "Available"; this row said nothing at all,
     * because a corridor nobody can hold has no ACCOUNT to report. Silence on
     * one screen and a status on the other is still two screens disagreeing
     * about one thing (QA script step 7).
     */
    describe('a corridor nobody can hold says the same as the other screen', () => {
        /*
         * Konrad, 2026-09-23: Argentina can never be an account number, so it
         * is not under "Your account numbers". It is a one-off transfer, listed
         * with the other ways to add money from a bank, and a row that simply
         * works carries no badge.
         */
        it('lists the Argentine transfer under Add money from your bank, with no badge, when the user can use it', () => {
            const gates = allGates({ kind: 'needs-enrollment' })
            gates.BANK_TRANSFER_AR = READY
            const { container } = list(false, { corridors: ['BANK_TRANSFER_AR'], gates })

            const row = rowOf(container, 'BANK_TRANSFER_AR') as HTMLElement
            expect(within(screen.getByTestId('bank-top-up')).getByTestId('deposit-account-BANK_TRANSFER_AR')).toBe(row)
            expect(screen.queryByTestId('your-accounts')?.contains(row) ?? false).toBe(false)
            expect(within(row).getByText('One-off transfer via Mercado Pago')).toBeInTheDocument()
            for (const badge of ['Available', 'Ready', 'Not set up', 'Not available'])
                expect(within(row).queryByText(badge)).not.toBeInTheDocument()
        })

        it('shows verification when that can unlock the Argentine rail', () => {
            const gates = allGates({ kind: 'needs-enrollment' })
            gates.BANK_TRANSFER_AR = { kind: 'needs-identity' }
            const { container } = list(false, { corridors: ['BANK_TRANSFER_AR'], gates })

            expect(inRow(container, 'BANK_TRANSFER_AR').queryByText('Available')).not.toBeInTheDocument()
            expect(inRow(container, 'BANK_TRANSFER_AR').getByText('Requires verification')).toBeInTheDocument()
            expect(rowOf(container, 'BANK_TRANSFER_AR')).not.toHaveAttribute('aria-disabled', 'true')
        })

        // a dead end is no row at all: its own flow would only say it is not for them
        it('leaves the Argentine row out when the user cannot use it', () => {
            const gates = allGates({ kind: 'needs-enrollment' })
            const { container } = list(false, { corridors: ['BANK_TRANSFER_AR'], gates })

            expect(rowOf(container, 'BANK_TRANSFER_AR')).not.toBeInTheDocument()
            expect(countriesTrigger()).toBeInTheDocument()
        })
    })

    /**
     * "Not set up" is a claim the user can set one up. At the account cap they
     * cannot — they hold every account we open for them — yet the same rail
     * still takes a transfer they send themselves, and the deposit route would
     * have accepted it. The row said "Not set up" and led to "Contact support",
     * which is the one string on this screen that was simply false.
     */
    describe('a corridor the user cannot open but can still deposit on', () => {
        const capped = { claimable: { SEPA_EU: offered('SEPA_EU', 'account-limit') } }

        it('reads Available, never Not set up', () => {
            const { container } = list(false, capped)

            expect(inRow(container, 'SEPA_EU').getByText('Available')).toBeInTheDocument()
            expect(inRow(container, 'SEPA_EU').queryByText('Not set up')).not.toBeInTheDocument()
        })

        it('keeps the row tappable, because there is something behind it', () => {
            const { container } = list(false, capped)

            expect(rowOf(container, 'SEPA_EU')).not.toHaveAttribute('aria-disabled', 'true')
        })

        /*
         * Colombia has no live country for its corridor, so there is no
         * transfer to offer. The row must not promise one — that would be the
         * same lie with a friendlier word.
         */
        it('says nothing is available where no transfer exists either', () => {
            const { container } = list(false, {
                claimable: { BANK_TRANSFER_CO: offered('BANK_TRANSFER_CO', 'account-limit') },
            })

            expect(inRow(container, 'BANK_TRANSFER_CO').queryByText('Available')).not.toBeInTheDocument()
        })

        // A corridor the user CAN open is set up by them, so the old word holds.
        it('still says Not set up where the user can set one up', () => {
            const { container } = list(false, { claimable: { SEPA_EU: offered('SEPA_EU') } })

            expect(inRow(container, 'SEPA_EU').getByText('Not set up')).toBeInTheDocument()
        })
    })

    // Status belongs to the badge on every row, and the rows carry no subtitle:
    // the arrival time and the residence caveat moved off the hub so the list
    // reads as one consistent column of "currency · rail" and a status badge.
    it('says a corridor is not set up once it knows that is true, in the badge', () => {
        const { container } = list(false)

        expect(inRow(container, 'SEPA_EU').getByText('Not set up')).toBeInTheDocument()
        expect(inRow(container, 'SEPA_EU').queryByText('Same business day')).not.toBeInTheDocument()
    })

    it('carries a held corridor with a Ready badge and no subtitle', () => {
        const { container } = list(false, { accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') } })

        expect(inRow(container, 'SEPA_EU').getByText('Ready')).toBeInTheDocument()
        expect(inRow(container, 'SEPA_EU').queryByText('Same business day')).not.toBeInTheDocument()
    })

    /**
     * A failed read says nothing about what the user holds. "Not set up" is a
     * claim about their account, and the all-undefined fallback map cannot
     * make it — the retry notice above owns this state.
     */
    it('claims nothing about a corridor when the accounts could not be read', () => {
        const { container } = list(false, { isError: true })

        expect(inRow(container, 'SEPA_EU').queryByText('Not set up')).not.toBeInTheDocument()
        expect(screen.getByText(messages.depositAccounts.list.errorTitle)).toBeInTheDocument()
    })

    /**
     * "Ready" means a payer can be handed these details today. A retiring
     * account cannot be, so it reads as active rather than ready — the same
     * answer the details footer gives.
     */
    it('does not call a retiring corridor ready', () => {
        const retiring = { ...heldAccount('SEPA_EU'), status: 'retiring' as const }
        const { container } = list(false, { accounts: { ...NONE, SEPA_EU: retiring } })

        expect(inRow(container, 'SEPA_EU').queryByText('Ready')).not.toBeInTheDocument()
        expect(inRow(container, 'SEPA_EU').getByText('Active')).toBeInTheDocument()
    })

    it('opens revoked details so support stays reachable', () => {
        const revoked = { ...heldAccount('SEPA_EU'), status: 'revoked' as const }
        const onOpen = jest.fn()
        const { container } = list(false, { accounts: { ...NONE, SEPA_EU: revoked }, onOpen })

        fireEvent.click(rowOf(container, 'SEPA_EU') as HTMLElement)
        expect(onOpen).toHaveBeenCalledWith('SEPA_EU')

        expect(inRow(container, 'SEPA_EU').getByText(messages.depositAccounts.list.badgeRevoked)).toBeInTheDocument()
    })

    // A row that only points at a top-up flow has no account behind it, so it
    // has no status to carry: a badge there would be a claim about something
    // that does not exist.
    it('badges no pointer row at all', () => {
        const { container } = list(false, { corridors: ['PIX_BR'] })

        expect(inRow(container, 'PIX_BR').queryByText('Not available')).not.toBeInTheDocument()
        expect(inRow(container, 'PIX_BR').queryByText('Not set up')).not.toBeInTheDocument()
        expect(inRow(container, 'BANK_TRANSFER_AR').queryByText('Not set up')).not.toBeInTheDocument()
    })

    it('does not open a corridor whose state is not known yet', () => {
        const { container } = list(true)
        expect(rowOf(container, 'SEPA_EU')).toHaveAttribute('aria-disabled', 'true')
    })
})

/**
 * The rows are the user's own rails. A corridor the user has no rail for is
 * absent, not present and unavailable — the whole screen used to offer an
 * Argentine row to somebody in Germany, who could only read "Unavailable".
 */
describe("DepositAccountsListScreen renders the user's corridors and no others", () => {
    it('shows an Argentine user their Manteca corridors alone', () => {
        const { container } = list(false, { corridors: ['PIX_BR', 'BANK_TRANSFER_AR'] })

        expect(rowOf(container, 'BANK_TRANSFER_AR')).toBeInTheDocument()
        expect(rowOf(container, 'PIX_BR')).toBeInTheDocument()
        expect(rowOf(container, 'SEPA_EU')).not.toBeInTheDocument()
        expect(rowOf(container, 'ACH_US')).not.toBeInTheDocument()
    })

    /**
     * Their own corridors, plus the residence-gated one everybody sees. The ARS
     * row is present for a European user because it is worth knowing about
     * before the move, and the top-up flow behind it states the residence rule.
     * Brazil's Pix top-up is residence-gated the same way (2026-09-22), so it
     * is there too, and the flow behind it states the rule.
     */
    it('shows a European user their Bridge corridors plus the residence-gated rows', () => {
        const { container } = list(false, { corridors: ['SEPA_EU', 'FASTER_PAYMENTS_GB', 'ACH_US', 'SPEI_MX'] })

        for (const corridor of ['SEPA_EU', 'FASTER_PAYMENTS_GB', 'ACH_US', 'SPEI_MX'] as const) {
            expect(rowOf(container, corridor)).toBeInTheDocument()
        }
        expect(rowOf(container, 'BANK_TRANSFER_AR')).toBeInTheDocument()
        expect(rowOf(container, 'PIX_BR')).toBeInTheDocument()
        // a corridor with neither a rail nor the residence rule stays absent
        expect(rowOf(container, 'BANK_TRANSFER_CO')).not.toBeInTheDocument()
    })

    /**
     * A user with no bank rail of their own is not left with an empty screen:
     * the countries and crypto answer the rest.
     */
    it('leaves the countries when the user has no bank rail', () => {
        // a verified user whose region has no rail reads needs-enrollment
        const { container } = list(false, { corridors: [], gates: allGates({ kind: 'needs-enrollment' }) })

        expect(rowOf(container, 'SEPA_EU')).not.toBeInTheDocument()
        expect(rowOf(container, 'BANK_TRANSFER_AR')).not.toBeInTheDocument()
        expect(countriesTrigger()).toBeInTheDocument()
        // COP is not residence-gated, so its row belongs to the users whose
        // rails name it, like MXN
        expect(rowOf(container, 'BANK_TRANSFER_CO')).not.toBeInTheDocument()
    })

    /**
     * A user who has not verified holds a rail for nothing. Rather than hide the
     * standing accounts, the hub shows the ones the backend named for them,
     * badged with what they need — so the user learns the accounts exist and
     * what opens them. The row leads to verification: a badge naming an action,
     * on a row that does not take the tap, is the dead end Hugo rejected.
     */
    it('shows an unverified user the corridors the backend named, badged with what they need', () => {
        const { container } = list(false, {
            corridors: ['SEPA_EU', 'FASTER_PAYMENTS_GB', 'ACH_US', 'SPEI_MX'],
            gates: allGates({ kind: 'needs-identity' }),
        })

        for (const corridor of ['SEPA_EU', 'FASTER_PAYMENTS_GB', 'ACH_US', 'SPEI_MX'] as const) {
            expect(rowOf(container, corridor)).toBeInTheDocument()
            expect(rowOf(container, corridor)).not.toHaveAttribute('aria-disabled', 'true')
        }
        expect(inRow(container, 'SEPA_EU').getByText(messages.depositAccounts.list.badgeVerify)).toBeInTheDocument()
        // a top-up-only corridor is not a standing account; the two Manteca ones
        // are residence-gated and shown to everybody, the COP corridor stays out
        expect(rowOf(container, 'BANK_TRANSFER_CO')).not.toBeInTheDocument()
    })

    /**
     * The hub must not invent a corridor out of the catalogue.
     *
     * The gate answers `needs-identity` both for "you have this rail, verify
     * and it opens" and for "this corridor is not part of your world at all",
     * so a catalogue fallback keyed on that gate promised Colombia to a user no
     * Colombian rail exists for — and took the row away again the moment they
     * verified. Neither state was a statement the backend made.
     */
    it.each([
        ['unverified', { kind: 'needs-identity' } as GateState],
        ['verified', { kind: 'needs-enrollment' } as GateState],
    ])('gives no row to a corridor the backend never mentioned (%s)', (_state, gate) => {
        const { container } = list(false, {
            corridors: ['SEPA_EU'],
            gates: allGates(gate),
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') },
        })

        expect(rowOf(container, 'BANK_TRANSFER_CO')).not.toBeInTheDocument()
        // the corridor it did mention is still a row, and still the user's
        expect(rowOf(container, 'SEPA_EU')).toBeInTheDocument()
    })

    describe('the account counter', () => {
        const LIST = messages.depositAccounts.list
        const counter = (used: number, cap: number) =>
            LIST.accountCounter.replace('{used}', String(used)).replace('{cap}', String(cap))

        it('shows the count up front, so the limit is information and not a wall', () => {
            list(false)

            expect(screen.getByTestId('account-counter')).toHaveTextContent(counter(0, 2))
            expect(screen.getByText(LIST.accountLimitNote.replace('{cap}', '2'))).toBeInTheDocument()
        })

        it('says the limit is reached when the backend says so', () => {
            list(false, {
                accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU'), ACH_US: heldAccount('ACH_US') },
                claimable: { SPEI_MX: offered('SPEI_MX', 'account-limit') },
            })

            expect(screen.getByTestId('account-counter')).toHaveTextContent(counter(2, 2))
            expect(screen.getByText(LIST.accountLimitReached.replace('{cap}', '2'))).toBeInTheDocument()
        })

        it('states the limit the backend sends, raised or not', () => {
            // two accounts with room left: the fallback cannot read this limit
            list(false, { slotsHeld: 2, accountLimit: 5, claimable: { SPEI_MX: offered('SPEI_MX') } })

            expect(screen.getByTestId('account-counter')).toHaveTextContent(counter(2, 5))
            expect(screen.getByText(LIST.accountLimitNote.replace('{cap}', '5'))).toBeInTheDocument()
        })

        it('says the limit is reached from the numbers alone', () => {
            list(false, { slotsHeld: 3, accountLimit: 3 })

            expect(screen.getByText(LIST.accountLimitReached.replace('{cap}', '3'))).toBeInTheDocument()
        })

        it('uses the limit support raised, not the default', () => {
            list(false, { slotsHeld: 3, claimable: { SPEI_MX: offered('SPEI_MX', 'account-limit') } })

            expect(screen.getByTestId('account-counter')).toHaveTextContent(counter(3, 3))
        })

        it('shows no number for a raised limit it cannot read', () => {
            // two accounts and the backend still offers a third: the limit is
            // above the default, and the response does not say what it is
            list(false, { slotsHeld: 2, claimable: { SPEI_MX: offered('SPEI_MX') } })

            expect(screen.queryByTestId('account-counter')).not.toBeInTheDocument()
            expect(screen.queryByText(LIST.accountLimitReached.replace('{cap}', '2'))).not.toBeInTheDocument()
        })

        it('does not count a revoked account, which takes no slot', () => {
            list(false, { accounts: { ...NONE, SEPA_EU: { ...heldAccount('SEPA_EU'), status: 'revoked' } } })

            expect(screen.getByTestId('account-counter')).toHaveTextContent(counter(0, 2))
        })

        it.each([
            ['the read is in flight', true, false],
            ['the read failed', false, true],
        ])('is hidden while %s', (_, isLoading, isError) => {
            list(isLoading, { isError })

            expect(screen.queryByTestId('account-counter')).not.toBeInTheDocument()
            expect(screen.queryByText(LIST.accountLimitNote.replace('{cap}', '2'))).not.toBeInTheDocument()
        })

        // The count is the Section's trailing slot, beside the heading rather
        // than inside it, so the heading is named by its title alone (A8).
        it('sits beside the heading, not inside it', () => {
            list(false)

            const heading = screen.getByRole('heading', { name: LIST.sectionTitle })
            expect(heading).toHaveTextContent(new RegExp(`^${LIST.sectionTitle}$`))
            expect(heading.contains(screen.getByTestId('account-counter'))).toBe(false)
            expect(heading.parentElement?.contains(screen.getByTestId('account-counter'))).toBe(true)
        })

        it('explains the limit from a real, named button, for touch and keyboard', () => {
            list(false)

            const why = within(screen.getByTestId('account-counter')).getByRole('button', {
                name: LIST.accountLimitWhyLabel,
            })
            fireEvent.click(why)
            expect(screen.getByText(LIST.accountLimitWhy)).toBeInTheDocument()
        })
    })

    /**
     * Two corridors are offered before the user has a rail: the tap asks the
     * provider for a review. A verified user reads `needs-enrollment` there, and
     * after the tap `pending`, so the capability gate alone would close the row
     * for good. The backend's offer is what opens it.
     */
    describe('a corridor the backend offers a verified user with no rail', () => {
        const gates = { ...allGates(), BANK_TRANSFER_CO: { kind: 'needs-enrollment' } as GateState }

        it('stays tappable, because the tap is what asks for the review', () => {
            const onOpen = jest.fn()
            const { container } = list(false, {
                gates,
                claimable: { BANK_TRANSFER_CO: offered('BANK_TRANSFER_CO') },
                onOpen,
            })

            expect(rowOf(container, 'BANK_TRANSFER_CO')).not.toHaveAttribute('aria-disabled', 'true')
            fireEvent.click(rowOf(container, 'BANK_TRANSFER_CO') as HTMLElement)
            expect(onOpen).toHaveBeenCalledWith('BANK_TRANSFER_CO')
        })

        it('says something is needed when the review waits on the user, and never "verify"', () => {
            const onOpen = jest.fn()
            const { container } = list(false, {
                gates: { ...gates, BANK_TRANSFER_CO: { kind: 'pending' } },
                claimable: { BANK_TRANSFER_CO: offered('BANK_TRANSFER_CO', 'endorsement-required') },
                onOpen,
            })

            const row = inRow(container, 'BANK_TRANSFER_CO')
            expect(row.getByText(messages.depositAccounts.list.badgeActionNeeded)).toBeInTheDocument()
            expect(row.queryByText(messages.depositAccounts.list.badgeVerify)).not.toBeInTheDocument()
            // the screen behind the row says what to do, so the row opens
            fireEvent.click(rowOf(container, 'BANK_TRANSFER_CO') as HTMLElement)
            expect(onOpen).toHaveBeenCalledWith('BANK_TRANSFER_CO')
        })

        it('keeps the under-review badge while the provider reviews', () => {
            const { container } = list(false, {
                gates: { ...gates, BANK_TRANSFER_CO: { kind: 'pending' } },
                claimable: { BANK_TRANSFER_CO: offered('BANK_TRANSFER_CO', 'endorsement-pending') },
            })

            expect(inRow(container, 'BANK_TRANSFER_CO').getByText('Pending')).toBeInTheDocument()
            expect(rowOf(container, 'BANK_TRANSFER_CO')).not.toHaveAttribute('aria-disabled', 'true')
        })

        it('leaves a corridor the backend does not offer closed', () => {
            const { container } = list(false, { gates })

            expect(rowOf(container, 'BANK_TRANSFER_CO')).toHaveAttribute('aria-disabled', 'true')
        })
    })
})

/**
 * The gate is asked one corridor at a time. A bank-wide gate answers "ready"
 * as soon as ANY bank rail is enabled, which let a user with one working
 * Manteca rail tap into four Bridge corridors they have no rail for — and the
 * claim only failed once the POST reached the provider.
 */
describe('DepositAccountsListScreen gates each corridor on its own rail', () => {
    it('leaves Bridge corridors shut for a user whose only enabled rail is Manteca', () => {
        // what `gateFor('deposit', { railId })` returns for a verified user with
        // no Bridge rail in the capability block
        const gates = allGates({ kind: 'needs-enrollment' })
        gates.PIX_BR = READY
        gates.BANK_TRANSFER_AR = READY

        const { container } = list(false, { gates })

        for (const corridor of ['SEPA_EU', 'ACH_US', 'FASTER_PAYMENTS_GB', 'SPEI_MX'] as const) {
            expect(rowOf(container, corridor)).toHaveAttribute('aria-disabled', 'true')
        }
        // the Manteca rows are not claims at all — they are the user's own
        // top-up details, and they stay reachable
        expect(rowOf(container, 'BANK_TRANSFER_AR')).not.toHaveAttribute('aria-disabled', 'true')
    })

    it('opens only the corridor whose own rail is enabled', () => {
        const gates = allGates({ kind: 'needs-enrollment' })
        gates.ACH_US = READY

        const { container } = list(false, { gates })

        expect(rowOf(container, 'ACH_US')).not.toHaveAttribute('aria-disabled', 'true')
        expect(rowOf(container, 'SEPA_EU')).toHaveAttribute('aria-disabled', 'true')
    })
})

/**
 * A read that failed is not "you hold nothing". Rendering the empty fallback
 * map as six unclaimed corridors invites a user to open an account they may
 * already have.
 */
describe('DepositAccountsListScreen when the accounts cannot be read', () => {
    it('says so and offers to try again, instead of offering claims', () => {
        const { container } = list(false, { isError: true })

        expect(screen.getByText(/could not load your accounts/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
        expect(rowOf(container, 'SEPA_EU')).toHaveAttribute('aria-disabled', 'true')
    })
})

/**
 * Which screen is right depends on a network answer. Before it arrives, a
 * missing account is indistinguishable from one that was never claimed — so
 * the flow must not offer to open an account the user may already hold.
 */
describe('DepositAccountsFlow while the accounts are loading', () => {
    const flow = (isLoading: boolean, gates: Record<DepositCorridor, GateState> = allGates(), isError = false) =>
        render(
            <NextIntlClientProvider locale="en" messages={messages}>
                <NuqsTestingAdapter searchParams="?step=details&corridor=SEPA_EU">
                    <DepositAccountsFlow
                        corridors={DEPOSIT_RAIL_ORDER}
                        accounts={NONE}
                        gates={gates}
                        isLoading={isLoading}
                        isError={isError}
                        userName="Demo User"
                        onExit={() => {}}
                        onClaim={() => {}}
                        onResolveGate={() => {}}
                        onRetry={() => {}}
                        onContactSupport={() => {}}
                    />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        )

    it('shows neither claim nor details until it knows which is true', () => {
        flow(true)
        expect(screen.queryByRole('button', { name: /open eur account/i })).not.toBeInTheDocument()
    })

    // The other half of the pair: once the answer is in, a corridor the user
    // does not hold really does offer to open one. Without this, the assertion
    // above would pass against any screen at all.
    it('offers to open the account once it knows there is none', () => {
        flow(false)
        expect(screen.getByRole('button', { name: /open eur account/i })).toBeInTheDocument()
    })

    // A hand-edited `?corridor=` must not borrow a sibling corridor's gate.
    it('refuses the claim step when the SELECTED corridor is blocked', () => {
        const gates = allGates({ kind: 'needs-enrollment' })
        gates.ACH_US = READY
        flow(false, gates)
        expect(screen.queryByRole('button', { name: /open eur account/i })).not.toBeInTheDocument()
    })
})

/**
 * The gate says whether a user may OPEN an account. It does not say whether
 * they may read one they already hold — money is arriving on those details
 * whatever the gate decided afterwards.
 */
describe('DepositAccountsListScreen when a corridor is blocked after the fact', () => {
    it('keeps an account the user already holds open to read', () => {
        const gates = allGates({ kind: 'needs-enrollment' })
        const { container } = list(false, { gates, accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') } })

        expect(rowOf(container, 'SEPA_EU')).not.toHaveAttribute('aria-disabled', 'true')
        // the corridor with nothing to read stays shut
        expect(rowOf(container, 'ACH_US')).toHaveAttribute('aria-disabled', 'true')
    })

    /**
     * The banner is gone. It told a user holding two Ready accounts to verify
     * their identity, because the residence-gated rows everybody sees carry a
     * `needs-identity` gate for anyone without those rails. The gate belongs to
     * the corridor now: the row stays tappable and the tap explains itself.
     */
    it('never puts a gate banner over the list', () => {
        const gates = allGates({ kind: 'needs-identity' })
        const { container } = list(false, { gates, corridors: ['SEPA_EU', 'ACH_US'] })

        expect(screen.queryByText('Verify your identity first')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /verify identity/i })).not.toBeInTheDocument()
        // and the rows it used to speak for are still there to tap
        expect(rowOf(container, 'SEPA_EU')).toBeInTheDocument()
    })
})

describe('the residence-gated rows and the tap behind them', () => {
    /**
     * The Argentine row is everybody's. It stays present and tappable whatever
     * the identity gate says: the top-up flow behind it states the residence
     * rule.
     */
    it('leaves the residence-gated row alone when residence is unknown', () => {
        const gates = allGates({ kind: 'needs-identity' })
        const { container } = list(false, {
            gates,
            corridors: ['SEPA_EU'],
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') },
        })

        expect(rowOf(container, 'BANK_TRANSFER_AR')).toBeInTheDocument()
        expect(rowOf(container, 'BANK_TRANSFER_AR')).not.toHaveAttribute('aria-disabled', 'true')
    })

    it('carries an Argentine row for everybody', () => {
        const { container } = list(false, { corridors: ['SEPA_EU'] })

        expect(rowOf(container, 'BANK_TRANSFER_AR')).toBeInTheDocument()
    })

    /**
     * Argentina has no account to open: the provider mints a CVU per deposit
     * and holds it. The row is a pointer at the top-up flow, which owns the
     * verification step from there — so residence does not change where the
     * tap goes, and there is no second screen saying the same thing.
     */
    it.each([['AR'], ['DE']])('sends the Argentine row to the local top-up for a %s resident', (iso2) => {
        residenceIso2s = [iso2]
        const onOpen = jest.fn()
        const { container } = list(false, { corridors: ['SEPA_EU'], onOpen })

        fireEvent.click(rowOf(container, 'BANK_TRANSFER_AR') as HTMLElement)
        // the top-up push carries a returnTo back to the hub, so leaving
        // verification lands on the hub, not the bare amount route
        expect(mockPush).toHaveBeenCalledWith(withReturnTo('/add-money/argentina/manteca', HUB_RETURN))
        expect(onOpen).not.toHaveBeenCalled()
    })

    /**
     * Brazil has ONE row. Reais stay on the per-payment Pix code, so there is
     * no standing account beside it: two rows led a Brazilian resident to the
     * same top-up.
     */
    it('shows one Brazilian row, the Pix top-up, and sends it to the local flow', () => {
        const onOpen = jest.fn()
        const { container } = list(false, { corridors: ['PIX_BR'], onOpen })

        expect(container.querySelectorAll('[data-testid^="deposit-account-"][data-testid*="_BR"]')).toHaveLength(1)
        fireEvent.click(rowOf(container, 'PIX_BR') as HTMLElement)
        expect(mockPush).toHaveBeenCalledWith(withReturnTo('/add-money/brazil/manteca', HUB_RETURN))
        expect(onOpen).not.toHaveBeenCalled()
    })
})

/**
 * The home drawer already asks bank or crypto. Asking again on the screen the
 * bank answer opens is the question the user just settled.
 */
describe('the crypto row', () => {
    it('is absent when the hub was entered as the bank answer', () => {
        list(false, { searchParams: '?method=bank' })

        expect(screen.queryByTestId('add-money-crypto')).not.toBeInTheDocument()
    })

    it('is there on any other way in', () => {
        list(false, { searchParams: '?corridor=SEPA_EU' })

        expect(screen.getByTestId('add-money-crypto')).toBeInTheDocument()
    })
})

/**
 * A read that failed says nothing about what the user holds. A deep link into
 * it must not reach a live claim button on an account that may already exist.
 */
describe('DepositAccountsFlow when the accounts cannot be read', () => {
    it('falls back to the list and its retry rather than offering the claim', () => {
        render(
            <NextIntlClientProvider locale="en" messages={messages}>
                <NuqsTestingAdapter searchParams="?step=claim&corridor=SEPA_EU">
                    <DepositAccountsFlow
                        corridors={DEPOSIT_RAIL_ORDER}
                        accounts={NONE}
                        gates={allGates()}
                        isLoading={false}
                        isError
                        userName="Demo User"
                        onExit={() => {}}
                        onClaim={() => {}}
                        onResolveGate={() => {}}
                        onRetry={() => {}}
                        onContactSupport={() => {}}
                    />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        )

        expect(screen.queryByRole('button', { name: /open eur account/i })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
})

/**
 * `?corridor=` is a user input like any other. A link minted for a corridor the
 * user has no rail for has to land somewhere true.
 */
describe('DepositAccountsFlow when a link names a corridor the user has no rail for', () => {
    it('lands an Argentine link on the list, which points at the Argentine flow', () => {
        render(
            <NextIntlClientProvider locale="en" messages={messages}>
                <NuqsTestingAdapter searchParams="?step=details&corridor=BANK_TRANSFER_AR">
                    <DepositAccountsFlow
                        corridors={['SEPA_EU']}
                        accounts={NONE}
                        gates={allGates()}
                        isLoading={false}
                        userName="Demo User"
                        onExit={() => {}}
                        onClaim={() => {}}
                        onResolveGate={() => {}}
                        onRetry={() => {}}
                        onContactSupport={() => {}}
                    />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        )

        // Argentina has no corridor screen of its own: the hub row points at
        // the top-up flow, and that flow states its own verification rule
        expect(
            screen.queryByText(messages.depositAccounts.details.unavailableTitle.replace('{currency}', 'ARS'))
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText(messages.depositAccounts.corridors.BANK_TRANSFER_AR.residenceTitle)
        ).not.toBeInTheDocument()
        expect(screen.getByText(messages.depositAccounts.list.addHeading)).toBeInTheDocument()
    })
})

/**
 * The cursor shipped as `?screen=` and was renamed to `?step=`, the name every
 * other flow in the app uses. Links already minted must still land.
 */
describe('DepositAccountsFlow accepts the cursor by its old name', () => {
    it('opens the step a `?screen=` link asked for', () => {
        render(
            <NextIntlClientProvider locale="en" messages={messages}>
                <NuqsTestingAdapter searchParams="?screen=claim&corridor=SEPA_EU">
                    <DepositAccountsFlow
                        corridors={DEPOSIT_RAIL_ORDER}
                        accounts={NONE}
                        gates={allGates()}
                        userName="Demo User"
                        onExit={() => {}}
                        onClaim={() => {}}
                        onResolveGate={() => {}}
                        onRetry={() => {}}
                        onContactSupport={() => {}}
                    />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        )
        expect(screen.getByRole('button', { name: /open eur account/i })).toBeInTheDocument()
    })
})

/**
 * One screen answers both jobs: the accounts this user holds, and every country
 * they can send money in from. They were two screens that disagreed about what
 * a country offered, and a user who wanted bank details had to guess which one
 * to open.
 */
describe('the hub carries the accounts, crypto and the countries together', () => {
    it('shows the accounts, one crypto row and the collapsed countries', () => {
        const { container } = list(false)

        expect(rowOf(container, 'SEPA_EU')).toBeInTheDocument()
        expect(screen.getAllByTestId('add-money-crypto')).toHaveLength(1)
        expect(screen.getByText(messages.depositAccounts.list.countriesTitle)).toBeInTheDocument()
        expect(countriesTrigger()).toBeInTheDocument()
    })

    it('carries the pitch line under each section title', () => {
        list(false)

        expect(screen.getByText(messages.depositAccounts.list.accountsPitch)).toBeInTheDocument()
        expect(screen.getByText(messages.depositAccounts.list.countriesPitch)).toBeInTheDocument()
    })

    it('opens the crypto flow from its own row', () => {
        list(false)

        fireEvent.click(screen.getByTestId('add-money-crypto'))
        expect(mockPush).toHaveBeenCalledWith('/add-money/crypto')
    })

    // A euro-zone country resolves to the EUR corridor in place — the routing
    // hook owns which corridor, and it is tested on its own.
    it('hands a picked country to the one country resolver', () => {
        list(false)

        fireEvent.click(countriesTrigger())
        fireEvent.click(screen.getByTestId('country-germany'))
        expect(mockOpenCountry).toHaveBeenCalledWith(expect.objectContaining({ iso2: 'DE', path: 'germany' }))
    })

    it('marks a country with nothing behind it unsupported, so the list offers the waitlist', () => {
        mockIsCountrySupported.mockReturnValue(false)
        list(false)

        fireEvent.click(countriesTrigger())
        expect(screen.getByTestId('country-germany')).toHaveAttribute('data-supported', 'false')
    })

    /**
     * Standing accounts are dark in production. Until they are not, the hub is
     * the country list alone: an empty "Your accounts" section would ask a
     * question the flow cannot answer yet.
     */
    it('drops the accounts section while standing accounts are dark', () => {
        depositAccountsEnabled = false
        const { container } = list(false)

        expect(screen.queryByTestId('your-accounts')).not.toBeInTheDocument()
        expect(rowOf(container, 'SEPA_EU')).not.toBeInTheDocument()
        expect(countriesTrigger()).toBeInTheDocument()
    })

    /**
     * The flag is the rollback lever, and turning it off must not hide bank
     * details a user has already handed out: money keeps landing on them, and
     * the holder has to be able to read them — and the revoked state. Only
     * opening more goes dark: the corridors on offer, the counter, the cap note.
     */
    it('keeps the accounts a user already holds readable while standing accounts are dark', () => {
        depositAccountsEnabled = false
        const onOpen = jest.fn()
        const { container } = list(false, {
            corridors: ['SEPA_EU', 'ACH_US'],
            accounts: {
                ...NONE,
                SEPA_EU: heldAccount('SEPA_EU'),
                ACH_US: { ...heldAccount('ACH_US'), status: 'revoked' },
            },
            claimable: { FASTER_PAYMENTS_GB: offered('FASTER_PAYMENTS_GB') },
            accountLimit: 2,
            onOpen,
        })

        expect(rowOf(container, 'SEPA_EU')).toBeInTheDocument()
        expect(inRow(container, 'SEPA_EU').getByText(messages.depositAccounts.list.badgeReady)).toBeInTheDocument()
        expect(inRow(container, 'ACH_US').getByText(messages.depositAccounts.list.badgeRevoked)).toBeInTheDocument()
        // a corridor on offer is a claim, and claims are what the flag gates
        expect(rowOf(container, 'FASTER_PAYMENTS_GB')).not.toBeInTheDocument()
        expect(screen.queryByText(/of 2 used/)).not.toBeInTheDocument()

        fireEvent.click(rowOf(container, 'SEPA_EU') as HTMLElement)
        expect(onOpen).toHaveBeenCalledWith('SEPA_EU')
    })

    /**
     * Standing accounts are dark in production, so this is the order most users
     * see. Crypto sits below the bank options, not above them: the hub must not
     * lead with crypto.
     */
    it('renders the bank options above crypto while accounts are dark', () => {
        depositAccountsEnabled = false
        list(false)

        const countries = screen.getByTestId('other-countries')
        const crypto = screen.getByTestId('add-money-crypto')
        expect(countries.compareDocumentPosition(crypto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
})

/**
 * The countries are a long list and a second question. They stay folded until
 * the user asks for them.
 */
describe('the countries collapsible', () => {
    it('starts collapsed, showing only its title and pitch', () => {
        list(false)

        expect(screen.getByText(messages.depositAccounts.list.countriesTitle)).toBeInTheDocument()
        expect(screen.queryByTestId('country-list')).not.toBeInTheDocument()
    })

    it('expands on a tap and folds again, and says which it is', () => {
        list(false)

        expect(countriesTrigger()).toHaveAttribute('aria-expanded', 'false')

        fireEvent.click(countriesTrigger())
        expect(screen.getByTestId('country-list')).toBeInTheDocument()
        expect(countriesTrigger()).toHaveAttribute('aria-expanded', 'true')

        fireEvent.click(countriesTrigger())
        expect(screen.queryByTestId('country-list')).not.toBeInTheDocument()
    })

    /*
     * Konrad, 2026-09-23: the search lives in the other countries, not over the
     * whole screen. The page shows no field until the list is open, and then
     * the country list carries its own.
     */
    it('keeps the search inside the open country list', () => {
        list(false)

        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

        fireEvent.click(countriesTrigger())
        expect(screen.getByTestId('country-list')).toHaveAttribute('data-own-search', 'true')
    })
})

/**
 * Argentina and Brazil are open to residents alone. Everybody sees the rows —
 * they are worth knowing about before you move — and the top-up flow behind
 * the tap states the rule.
 */
describe('the residence-gated rows', () => {
    it('shows ARS and BRL to every user, and a corridor with neither a rail nor the rule to nobody', () => {
        const { container } = list(false, { corridors: ['SEPA_EU'] })

        expect(rowOf(container, 'BANK_TRANSFER_AR')).toBeInTheDocument()
        expect(rowOf(container, 'PIX_BR')).toBeInTheDocument()
        expect(rowOf(container, 'BANK_TRANSFER_CO')).not.toBeInTheDocument()
    })

    /**
     * COP is not one of them. Bridge opened a Bre-B account for a resident of
     * Portugal, so the row reads like MXN: a claimable account with a status
     * badge, not a residence-gated pointer.
     */
    it('shows the COP row as a claimable account, not a residence-gated one', () => {
        const { container } = list(false, { corridors: ['BANK_TRANSFER_CO'] })

        expect(rowOf(container, 'BANK_TRANSFER_CO')).toBeInTheDocument()
        expect(inRow(container, 'BANK_TRANSFER_CO').getByText('Not set up')).toBeInTheDocument()
    })

    it('keeps them tappable, because the screen behind them states the rule', () => {
        const onOpen = jest.fn()
        const { container } = list(false, { corridors: ['SEPA_EU'], onOpen })

        expect(rowOf(container, 'BANK_TRANSFER_AR')).not.toHaveAttribute('aria-disabled', 'true')
        fireEvent.click(rowOf(container, 'BANK_TRANSFER_AR') as HTMLElement)
        expect(mockPush).toHaveBeenCalledWith(withReturnTo('/add-money/argentina/manteca', HUB_RETURN))
        expect(onOpen).not.toHaveBeenCalled()
    })
})

/**
 * Three catalogs ship this screen. A key that exists only in English reaches a
 * Spanish user as its own raw name.
 */
describe('the hub copy exists in every catalog', () => {
    const HUB_KEYS = [
        'addTitle',
        'addHeading',
        'accountsPitch',
        'countriesPitch',
        'sectionTitle',
        'countriesTitle',
        'bankTopUpTitle',
    ]

    it('es-419 and pt-BR carry every key the hub reads', () => {
        for (const catalog of [esMessages, ptMessages]) {
            const listCopy = (catalog as any).depositAccounts.list
            for (const key of HUB_KEYS) expect(listCopy[key]).toBeTruthy()
            for (const corridor of ['BANK_TRANSFER_AR', 'PIX_BR']) expect(listCopy.oneOffBody[corridor]).toBeTruthy()
        }
    })
})

/*
 * Hugo, reading the hub with a greyed COP row five of seven: "why is colombia
 * grey? also always have grey items at bottom" — and, on the same row, "as a
 * user, how do I action 'requires verification'?". The screen answered neither:
 * the row sat mid-list, said a verified user must verify, and was not tappable.
 */
describe('a row the user cannot act on', () => {
    /** every account-number row, in the order the screen renders them */
    const renderedCorridors = (container: HTMLElement) =>
        Array.from(
            within(container).getByTestId('your-accounts').querySelectorAll('[data-testid^="deposit-account-"]')
        ).map((row) => row.getAttribute('data-testid')!.replace('deposit-account-', ''))

    const gatesWith = (corridor: DepositCorridor, gate: GateState) => ({ ...allGates(), [corridor]: gate })

    it('sorts below every row that leads somewhere, catalogue order kept inside each group', () => {
        // BANK_TRANSFER_CO sits fifth of seven in the catalogue; nothing can be
        // done with it, so it goes last.
        const { container } = list(false, {
            gates: gatesWith('BANK_TRANSFER_CO', { kind: 'blocked-rejection', userMessage: null }),
        })
        const order = renderedCorridors(container)
        expect(order.at(-1)).toBe('BANK_TRANSFER_CO')
        // the rest keep the catalogue's own order; the one-off transfers are
        // not account numbers and sit in their own section
        expect(order.slice(0, -1)).toEqual(
            DEPOSIT_RAIL_ORDER.filter((c) => !['BANK_TRANSFER_CO', 'PIX_BR', 'BANK_TRANSFER_AR'].includes(c))
        )
    })

    it('never names an action the user cannot take: no closed row carries an action badge', () => {
        const { container } = list(false, {
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') },
            gates: gatesWith('BANK_TRANSFER_CO', { kind: 'needs-identity' }),
        })
        for (const row of Array.from(container.querySelectorAll('[data-testid^="deposit-account-"]'))) {
            if (row.getAttribute('aria-disabled') !== 'true') continue
            expect(row.textContent).not.toMatch(/requires verification|action needed/i)
        }
    })

    it('tells a user who has not verified to verify, and lets them tap through to it', () => {
        const onOpen = jest.fn()
        // no account anywhere and no gate past the identity step: not verified
        const { container } = list(false, { gates: allGates({ kind: 'needs-identity' }), onOpen })
        const row = rowOf(container, 'BANK_TRANSFER_CO') as HTMLElement
        expect(within(row).getByText(/requires verification/i)).toBeInTheDocument()
        expect(row.getAttribute('aria-disabled')).not.toBe('true')
        fireEvent.click(row)
        expect(onOpen).toHaveBeenCalledWith('BANK_TRANSFER_CO')
    })

    it('does not tell a verified user to verify: the backend says the corridor is not offered', () => {
        // The app used to infer this from "holds an account, so must be
        // verified". The backend answers it per corridor now, so the inference
        // is gone — see the `unavailable` suite below.
        const { container } = list(false, {
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') },
            unavailable: { BANK_TRANSFER_CO: withheld('BANK_TRANSFER_CO', 'not-offered') },
        })
        const row = rowOf(container, 'BANK_TRANSFER_CO') as HTMLElement
        expect(within(row).queryByText(/requires verification/i)).not.toBeInTheDocument()
        expect(within(row).getByText(/not available/i)).toBeInTheDocument()
    })

    it('keeps the provider-review row tappable, where the endorsement page is the answer', () => {
        const { container } = list(false, {
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') },
            claimable: { BANK_TRANSFER_CO: offered('BANK_TRANSFER_CO', 'endorsement-required') },
        })
        const row = rowOf(container, 'BANK_TRANSFER_CO') as HTMLElement
        expect(row.getAttribute('aria-disabled')).not.toBe('true')
    })
})

/*
 * The backend now says WHY a corridor is withheld, per corridor. Before it did,
 * the screen guessed from the capability gate — which answers `needs-identity`
 * for a corridor whose rail it cannot read as well as for a user who has not
 * verified — and told a verified user with three live accounts to verify, on a
 * row that did not take a tap.
 */
describe('a withheld corridor, by the reason the backend gives', () => {
    it('identity-required: tappable, and says what is needed', () => {
        const onOpen = jest.fn()
        const { container } = list(false, {
            unavailable: { BANK_TRANSFER_CO: withheld('BANK_TRANSFER_CO', 'identity-required') },
            onOpen,
        })
        const row = rowOf(container, 'BANK_TRANSFER_CO') as HTMLElement
        expect(within(row).getByText(/requires verification/i)).toBeInTheDocument()
        expect(row.getAttribute('aria-disabled')).not.toBe('true')
        fireEvent.click(row)
        expect(onOpen).toHaveBeenCalledWith('BANK_TRANSFER_CO')
    })

    it('support-required: tappable, and points at a person rather than at verifying again', () => {
        const onOpen = jest.fn()
        const { container } = list(false, {
            unavailable: { BANK_TRANSFER_CO: withheld('BANK_TRANSFER_CO', 'support-required') },
            onOpen,
        })
        const row = rowOf(container, 'BANK_TRANSFER_CO') as HTMLElement
        expect(within(row).getByText(/contact support/i)).toBeInTheDocument()
        expect(within(row).queryByText(/requires verification/i)).not.toBeInTheDocument()
        expect(row.getAttribute('aria-disabled')).not.toBe('true')
        fireEvent.click(row)
        expect(onOpen).toHaveBeenCalledWith('BANK_TRANSFER_CO')
    })

    it('not-offered: the badge is the whole answer, so the row does not lead anywhere', () => {
        const { container } = list(false, {
            unavailable: { BANK_TRANSFER_CO: withheld('BANK_TRANSFER_CO', 'not-offered') },
        })
        const row = rowOf(container, 'BANK_TRANSFER_CO') as HTMLElement
        expect(within(row).getByText(/not available/i)).toBeInTheDocument()
        expect(row).toHaveAttribute('aria-disabled', 'true')
        // and it sorts below every row that leads somewhere
        const order = Array.from(
            screen.getByTestId('your-accounts').querySelectorAll('[data-testid^="deposit-account-"]')
        ).map((r) => r.getAttribute('data-testid')!.replace('deposit-account-', ''))
        expect(order.at(-1)).toBe('BANK_TRANSFER_CO')
    })

    it('told nothing about a corridor, it keeps the answer the gate gives', () => {
        // the backend would not guess — the provider read failed — so the
        // corridor is in none of its three lists and nothing here changes
        const { container } = list(false, { gates: { ...allGates(), BANK_TRANSFER_CO: { kind: 'needs-identity' } } })
        const row = rowOf(container, 'BANK_TRANSFER_CO') as HTMLElement
        expect(within(row).getByText(/requires verification/i)).toBeInTheDocument()
        expect(row.getAttribute('aria-disabled')).not.toBe('true')
    })
})

/*
 * Konrad, 2026-09-23: `custom` is a new element, and its accent colour made the
 * counter, "Not set up" and "Not available" read as one thing. A fact with no
 * tone takes the neutral status; nothing on this screen borrows the accent.
 */
describe('badges on the hub state status in DS colours', () => {
    const accentBadges = (container: HTMLElement) => container.querySelectorAll('.bg-background-badge-accent')

    it('draws the account counter and "Not set up" as neutral badges', () => {
        const { container } = list(false, { claimable: { ACH_US: offered('ACH_US') }, accountLimit: 2 })

        expect(within(screen.getByTestId('account-counter')).getByText('0 of 2 used')).toHaveClass(
            'bg-background-badge-helper'
        )
        expect(inRow(container, 'ACH_US').getByText('Not set up')).toHaveClass('bg-background-badge-helper')
        expect(accentBadges(container)).toHaveLength(0)
    })

    it('draws a dead end as neutral', () => {
        const { container } = list(false, {
            unavailable: { BANK_TRANSFER_CO: withheld('BANK_TRANSFER_CO', 'not-offered') },
        })

        expect(inRow(container, 'BANK_TRANSFER_CO').getByText(/not available/i)).toHaveClass(
            'bg-background-badge-helper'
        )
        expect(accentBadges(container)).toHaveLength(0)
    })

    it('lists the Brazilian Pix transfer with its own line and asks for verification where that opens it', () => {
        const gates = allGates()
        gates.PIX_BR = { kind: 'needs-identity' }
        const { container } = list(false, { corridors: ['PIX_BR'], gates })

        const row = inRow(container, 'PIX_BR')
        expect(row.getByText('One-off Pix transfer')).toBeInTheDocument()
        expect(row.getByText('Requires verification')).toHaveClass('bg-background-badge-attention')
    })
})

import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import esMessages from '@/i18n/app/messages/es-419.json'
import ptMessages from '@/i18n/app/messages/pt-BR.json'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { DepositAccountsFlow } from '../components/DepositAccountsFlow'
import { DepositAccountsListScreen } from '../components/DepositAccountsListScreen'
import { corridorRecord, DEPOSIT_RAIL_ORDER, emptyCorridorRecord } from '../rails'
import type { DepositAccount, DepositCorridor } from '../types'
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
        <div data-testid="country-list" data-continues-group={String(!!props.continuesGroup)}>
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

const rowOf = (container: HTMLElement, corridor: DepositCorridor) =>
    container.querySelector(`[data-testid="deposit-account-${corridor}"]`)

const inRow = (container: HTMLElement, corridor: DepositCorridor) => within(rowOf(container, corridor) as HTMLElement)

/** the countries toggle row, collapsed until tapped or until a search finds one */
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

    /**
     * "Unavailable" is for a corridor that is truly closed. A residence-gated
     * row is one residence away, so it reads the same as any corridor the user
     * has not opened — the screen behind the row carries the reason.
     */
    it('badges the residence-gated account row the same, and not as unavailable', () => {
        const { container } = list(false)

        expect(inRow(container, 'BANK_TRANSFER_BR').getByText('Not set up')).toBeInTheDocument()
        expect(inRow(container, 'BANK_TRANSFER_BR').queryByText('Unavailable')).not.toBeInTheDocument()
    })

    // A row that only points at a top-up flow has no account behind it, so it
    // has no status to carry: a badge there would be a claim about something
    // that does not exist.
    it('badges no pointer row at all', () => {
        const { container } = list(false, { corridors: ['PIX_BR'] })

        expect(inRow(container, 'PIX_BR').queryByText('Unavailable')).not.toBeInTheDocument()
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
     * Their own corridors, plus the residence-gated ones everybody sees. The
     * ARS and BRL rows are no longer absent for a European user — they are
     * present because the account is worth knowing about before the move, and
     * the screen behind the row states the residence rule (the row itself is
     * just "currency · rail" and a badge now).
     */
    it('shows a European user their Bridge corridors plus the residence-gated rows', () => {
        const { container } = list(false, { corridors: ['SEPA_EU', 'FASTER_PAYMENTS_GB', 'ACH_US', 'SPEI_MX'] })

        for (const corridor of ['SEPA_EU', 'FASTER_PAYMENTS_GB', 'ACH_US', 'SPEI_MX'] as const) {
            expect(rowOf(container, corridor)).toBeInTheDocument()
        }
        expect(rowOf(container, 'BANK_TRANSFER_AR')).toBeInTheDocument()
        expect(rowOf(container, 'BANK_TRANSFER_BR')).toBeInTheDocument()
        // a corridor with neither a rail nor the residence rule stays absent
        expect(rowOf(container, 'PIX_BR')).not.toBeInTheDocument()
    })

    /**
     * A user with no bank rail of their own is not left with an empty screen:
     * the residence-gated rows are there for everybody, and the countries and
     * crypto below answer the rest.
     */
    it('keeps only the rows everybody gets when the user has no bank rail', () => {
        // a verified user whose region has no rail reads needs-enrollment
        const { container } = list(false, { corridors: [], gates: allGates({ kind: 'needs-enrollment' }) })

        expect(rowOf(container, 'SEPA_EU')).not.toBeInTheDocument()
        expect(rowOf(container, 'BANK_TRANSFER_BR')).toBeInTheDocument()
        expect(rowOf(container, 'BANK_TRANSFER_AR')).toBeInTheDocument()
        // COP is not residence-gated, so its row belongs to the users whose
        // rails name it, like MXN
        expect(rowOf(container, 'BANK_TRANSFER_CO')).not.toBeInTheDocument()
    })

    /**
     * A user who has not verified holds a rail for nothing. Rather than hide the
     * standing accounts, the hub shows the claimable ones with a "verify to
     * unlock" badge, disabled — so the user learns the accounts exist and what
     * opens them. Only the identity gate does this: a verified user in a region
     * with no rail reads needs-enrollment and is spared rows they cannot open
     * (the test above).
     */
    it('shows the claimable accounts to an unverified user, badged to unlock', () => {
        const { container } = list(false, { corridors: [], gates: allGates({ kind: 'needs-identity' }) })

        for (const corridor of ['SEPA_EU', 'FASTER_PAYMENTS_GB', 'ACH_US', 'SPEI_MX', 'BANK_TRANSFER_CO'] as const) {
            expect(rowOf(container, corridor)).toBeInTheDocument()
            expect(rowOf(container, corridor)).toHaveAttribute('aria-disabled', 'true')
        }
        expect(inRow(container, 'SEPA_EU').getByText(messages.depositAccounts.list.badgeVerify)).toBeInTheDocument()
        // a top-up-only corridor is not a standing account, so it stays out
        expect(rowOf(container, 'PIX_BR')).not.toBeInTheDocument()
    })

    it('signals the standing-account limit with a live counter, before the wall', () => {
        list(false)

        // the counter is present up front, so the cap is information not a wall
        expect(screen.getByTestId('account-counter')).toHaveTextContent(
            messages.depositAccounts.list.accountCounter.replace('{used}', '0').replace('{cap}', '2')
        )
        // under the cap: the note says how to hold more
        expect(
            screen.getByText(messages.depositAccounts.list.accountLimitNote.replace('{cap}', '2'))
        ).toBeInTheDocument()
    })

    it('counts only held accounts and switches the note once the cap is reached', () => {
        list(false, {
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU'), ACH_US: heldAccount('ACH_US') },
        })

        expect(screen.getByTestId('account-counter')).toHaveTextContent(
            messages.depositAccounts.list.accountCounter.replace('{used}', '2').replace('{cap}', '2')
        )
        // at the cap: the reached note replaces the "open more" note
        expect(
            screen.getByText(messages.depositAccounts.list.accountLimitReached.replace('{cap}', '2'))
        ).toBeInTheDocument()
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
     * The BR and CO rows are everybody's. They stay present and tappable
     * whatever the identity gate says — the explainer behind them is where the
     * residence rule is stated now that the row carries no caveat subtitle.
     */
    it('leaves the residence-gated rows alone when residence is unknown', () => {
        const gates = allGates({ kind: 'needs-identity' })
        const { container } = list(false, {
            gates,
            corridors: ['SEPA_EU'],
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') },
        })

        expect(rowOf(container, 'BANK_TRANSFER_BR')).toBeInTheDocument()
        expect(rowOf(container, 'BANK_TRANSFER_BR')).not.toHaveAttribute('aria-disabled', 'true')
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

    it('falls back to the Pix top-up for a Brazilian resident with no account and no endorsement', () => {
        residenceIso2s = ['BR']
        const gates = allGates({ kind: 'needs-enrollment' })
        const onOpen = jest.fn()
        const { container } = list(false, { corridors: ['BANK_TRANSFER_BR'], gates, onOpen })

        fireEvent.click(rowOf(container, 'BANK_TRANSFER_BR') as HTMLElement)
        expect(mockPush).toHaveBeenCalledWith(withReturnTo('/add-money/brazil/manteca', HUB_RETURN))
        expect(onOpen).not.toHaveBeenCalled()
    })

    it('opens the claim for a Brazilian resident who is endorsed', () => {
        residenceIso2s = ['BR']
        const onOpen = jest.fn()
        const { container } = list(false, { corridors: ['BANK_TRANSFER_BR'], onOpen })

        fireEvent.click(rowOf(container, 'BANK_TRANSFER_BR') as HTMLElement)
        expect(onOpen).toHaveBeenCalledWith('BANK_TRANSFER_BR')
        expect(mockPush).not.toHaveBeenCalled()
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
 * the user asks for them, or until a search has already found one.
 */
describe('the countries collapsible', () => {
    const search = (text: string) =>
        fireEvent.change(screen.getByPlaceholderText(messages.depositAccounts.list.searchPlaceholder), {
            target: { value: text },
        })

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

    /**
     * The toggle and the countries are one card, not a toggle with a list
     * under it: the accordion this replaced had one bottom border and read as
     * a broken row beside the account rows above it.
     */
    it('renders the countries flush with the toggle row above them', () => {
        list(false)

        fireEvent.click(countriesTrigger())
        expect(screen.getByTestId('country-list')).toHaveAttribute('data-continues-group', 'true')
    })

    it('opens itself once a search of two characters finds a country', () => {
        list(false)

        search('p')
        expect(screen.queryByTestId('country-list')).not.toBeInTheDocument()

        search('po')
        expect(screen.getByTestId('country-list')).toBeInTheDocument()
    })

    it('folds again when the search is cleared', () => {
        list(false)

        search('portugal')
        expect(screen.getByTestId('country-list')).toBeInTheDocument()

        search('')
        expect(screen.queryByTestId('country-list')).not.toBeInTheDocument()
    })
})

/**
 * Brazil and Argentina are open to residents alone. Everybody sees the row —
 * the account is worth knowing about before you move — and the screen behind
 * the tap states the rule (the row itself carries no caveat subtitle now).
 */
describe('the residence-gated rows', () => {
    it('shows BRL and ARS to every user', () => {
        const { container } = list(false, { corridors: ['SEPA_EU'] })

        expect(rowOf(container, 'BANK_TRANSFER_BR')).toBeInTheDocument()
        expect(rowOf(container, 'BANK_TRANSFER_AR')).toBeInTheDocument()
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

        expect(rowOf(container, 'BANK_TRANSFER_BR')).not.toHaveAttribute('aria-disabled', 'true')
        fireEvent.click(rowOf(container, 'BANK_TRANSFER_BR') as HTMLElement)
        expect(onOpen).toHaveBeenCalledWith('BANK_TRANSFER_BR')
    })
})

/**
 * One field filters the whole screen. Two fields, or a field that only
 * filtered the countries, is what made this screen read as three unrelated
 * lists stacked on top of each other.
 */
describe('the hub search filters every section at once', () => {
    const search = (text: string) =>
        fireEvent.change(screen.getByPlaceholderText(messages.depositAccounts.list.searchPlaceholder), {
            target: { value: text },
        })

    it('keeps the corridors a currency names and drops the rest', () => {
        const { container } = list(false)

        search('eur')

        expect(rowOf(container, 'SEPA_EU')).toBeInTheDocument()
        expect(rowOf(container, 'ACH_US')).not.toBeInTheDocument()
        expect(rowOf(container, 'SPEI_MX')).not.toBeInTheDocument()
    })

    it('finds an account by its rail name', () => {
        const { container } = list(false)

        search('spei')

        expect(rowOf(container, 'SPEI_MX')).toBeInTheDocument()
        expect(rowOf(container, 'SEPA_EU')).not.toBeInTheDocument()
    })

    /**
     * Only the country table knows that Portugal pays in euro, so the country
     * match has to reach the account rows — a user searching their own country
     * is looking for the account it pays into.
     */
    it('finds the euro account by a euro-zone country name', () => {
        const { container } = list(false)

        search('portugal')

        expect(rowOf(container, 'SEPA_EU')).toBeInTheDocument()
        // a search that found countries opens the list on its own
        expect(screen.getByTestId('country-list')).toBeInTheDocument()
    })

    it('finds the crypto row by its own words, and hides the sections that do not match', () => {
        const { container } = list(false)

        search('crypto')

        expect(screen.getByTestId('add-money-crypto')).toBeInTheDocument()
        expect(rowOf(container, 'SEPA_EU')).not.toBeInTheDocument()
        expect(screen.queryByTestId('country-list')).not.toBeInTheDocument()
        expect(screen.queryByText(messages.depositAccounts.list.countriesTitle)).not.toBeInTheDocument()
    })

    it('hides a section title along with the section it labels', () => {
        list(false)

        search('eur')

        // the crypto row says nothing about euros
        expect(screen.queryByTestId('add-money-crypto')).not.toBeInTheDocument()
        expect(screen.getByText(messages.depositAccounts.list.sectionTitle)).toBeInTheDocument()
    })

    it('says so once when nothing matches anywhere, and clears the search', () => {
        const { container } = list(false)

        search('zzzzqq')

        expect(screen.getByText(/zzzzqq/)).toBeInTheDocument()
        expect(screen.queryByTestId('country-list')).not.toBeInTheDocument()
        expect(rowOf(container, 'SEPA_EU')).not.toBeInTheDocument()

        fireEvent.click(screen.getByText(messages.depositAccounts.list.clearSearch))

        expect(rowOf(container, 'SEPA_EU')).toBeInTheDocument()
        expect(countriesTrigger()).toBeInTheDocument()
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
        'searchPlaceholder',
        'noMatchTitle',
        'clearSearch',
    ]

    it('es-419 and pt-BR carry every key the hub reads', () => {
        for (const catalog of [esMessages, ptMessages]) {
            const listCopy = (catalog as any).depositAccounts.list as Record<string, string>
            for (const key of HUB_KEYS) expect(listCopy[key]).toBeTruthy()
        }
    })
})

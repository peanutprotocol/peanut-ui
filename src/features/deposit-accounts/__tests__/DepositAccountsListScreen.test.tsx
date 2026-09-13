import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { DepositAccountsFlow } from '../components/DepositAccountsFlow'
import { DepositAccountsListScreen } from '../components/DepositAccountsListScreen'
import { DEPOSIT_RAIL_ORDER } from '../rails'
import type { DepositAccount, DepositCorridor } from '../types'
import type { GateState } from '@/utils/capability-gate'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const READY: GateState = { kind: 'ready' }

/** one gate for every corridor, the way a user with every rail enabled looks */
const allGates = (gate: GateState = READY): Record<DepositCorridor, GateState> =>
    Object.fromEntries(DEPOSIT_RAIL_ORDER.map((corridor) => [corridor, gate])) as Record<DepositCorridor, GateState>

const NONE: Record<DepositCorridor, DepositAccount | undefined> = {
    ACH_US: undefined,
    SEPA_EU: undefined,
    FASTER_PAYMENTS_GB: undefined,
    SPEI_MX: undefined,
    PIX_BR: undefined,
    BANK_TRANSFER_AR: undefined,
}

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
    } = {}
) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <DepositAccountsListScreen
                corridors={opts.corridors ?? DEPOSIT_RAIL_ORDER}
                accounts={opts.accounts ?? NONE}
                gates={opts.gates ?? allGates()}
                isLoading={isLoading}
                isError={opts.isError ?? false}
                onBack={() => {}}
                onOpen={() => {}}
                onResolveGate={() => {}}
                onRetry={() => {}}
            />
        </NextIntlClientProvider>
    )

const rowOf = (container: HTMLElement, corridor: DepositCorridor) =>
    container.querySelector(`[data-testid="deposit-account-${corridor}"]`)

const inRow = (container: HTMLElement, corridor: DepositCorridor) => within(rowOf(container, corridor) as HTMLElement)

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

    // Status belongs to the badge on every row, and the body to the arrival
    // time alone. A row that said both ended up reading "Not set up yet"
    // under a "Ready" pill.
    it('says a corridor is not set up once it knows that is true, in the badge', () => {
        const { container } = list(false)

        expect(inRow(container, 'SEPA_EU').getByText('Not set up')).toBeInTheDocument()
        expect(inRow(container, 'SEPA_EU').getByText('Same business day')).toBeInTheDocument()
    })

    it('carries a held corridor the same way — badge for status, body for arrival', () => {
        const { container } = list(false, { accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') } })

        expect(inRow(container, 'SEPA_EU').getByText('Ready')).toBeInTheDocument()
        expect(inRow(container, 'SEPA_EU').getByText('Same business day')).toBeInTheDocument()
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

    // Neither Manteca corridor is a standing account, and the rail says so
    // whatever the accounts call returned.
    it('badges a corridor nobody can hold as unavailable', () => {
        const { container } = list(false)

        expect(inRow(container, 'BANK_TRANSFER_AR').getByText('Unavailable')).toBeInTheDocument()
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

    it('shows a European user their Bridge corridors alone', () => {
        const { container } = list(false, { corridors: ['SEPA_EU', 'FASTER_PAYMENTS_GB', 'ACH_US', 'SPEI_MX'] })

        for (const corridor of ['SEPA_EU', 'FASTER_PAYMENTS_GB', 'ACH_US', 'SPEI_MX'] as const) {
            expect(rowOf(container, corridor)).toBeInTheDocument()
        }
        expect(rowOf(container, 'BANK_TRANSFER_AR')).not.toBeInTheDocument()
    })

    it('says so plainly when the user has no bank rail at all', () => {
        const { container } = list(false, { corridors: [] })

        expect(screen.getByText(messages.depositAccounts.list.emptyTitle)).toBeInTheDocument()
        expect(rowOf(container, 'SEPA_EU')).not.toBeInTheDocument()
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

    it('names a blocker the user can clear, not one that only says to wait', () => {
        const gates = allGates({ kind: 'waiting-on-provider', userMessage: null })
        gates.ACH_US = { kind: 'needs-identity' }
        list(false, { gates })

        expect(screen.getByText('Verify your identity first')).toBeInTheDocument()
        expect(screen.queryByText('We are setting this up')).not.toBeInTheDocument()
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
    it('falls back to the list rather than opening a corridor that is not theirs', () => {
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
                    />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        )

        expect(
            screen.queryByText(messages.depositAccounts.details.unavailableTitle.replace('{currency}', 'ARS'))
        ).not.toBeInTheDocument()
        expect(screen.getByText(messages.depositAccounts.list.heading)).toBeInTheDocument()
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
                    />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        )
        expect(screen.getByRole('button', { name: /open eur account/i })).toBeInTheDocument()
    })
})

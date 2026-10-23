/**
 * The Smart Paperwork Engine's per-account refusals (api#1931,
 * `GET /users/kyc/paperwork`). Bridge publishes that some residences get every
 * account but one: no USD in Bangladesh, Pakistan, Kenya and nine others, no
 * EUR or GBP in the Central African Republic, Eritrea and Mali. It refused USD
 * to 79 of 85 Bangladesh residents. A refused account is never offered: the
 * row says why, and no tap leads to a claim or a verification for it.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import messages from '@/i18n/app/messages/en.json'
import type { KycPaperwork } from '@/services/kyc-paperwork'
import type { GateState } from '@/utils/capability-gate'
import { buildBankRows, type BankRowsInput } from '@/utils/unlock-payments.utils'
import { DepositAccountsFlow } from '../components/DepositAccountsFlow'
import { closedBankRow, closedOpenRow, virtualAccountRows } from '../hubRows'
import { corridorsClosedByPaperwork, withPaperworkRefusals } from '../paperwork'
import { corridorRecord, emptyCorridorRecord } from '../rails'
import type { ClaimableCorridor, DepositAccountView, DepositCorridor, UnavailableCorridor } from '../types'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/add-money',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
}))
jest.mock('../useResidenceIso2s', () => ({ useResidenceIso2s: () => ['BD'] }))
jest.mock('../components/DepositAccountsListScreen', () => ({
    DepositAccountsListScreen: () => <div data-testid="hub" />,
}))
jest.mock('../components/ClaimAccountScreen', () => ({
    ClaimAccountScreen: () => <div data-testid="claim" />,
}))

type Verdict = KycPaperwork['products'][number]

const open = (product: Verdict['product']): Verdict => ({ product, provider: 'BRIDGE', available: true })
const refused = (product: Verdict['product'], rule: string): Verdict => ({
    product,
    provider: 'BRIDGE',
    available: false,
    reason: 'account_unavailable_in_residence',
    rule,
})
const paperwork = (...products: Verdict[]): KycPaperwork => ({ products, requirements: [] })

/** what the engine answers a Bangladesh resident who picked bank accounts */
const BANGLADESH = paperwork(
    refused('bridge.usd', 'bridge.no-usd'),
    open('bridge.eur'),
    open('bridge.gbp'),
    open('bridge.mxn')
)
/** and a resident of Mali */
const MALI = paperwork(
    open('bridge.usd'),
    refused('bridge.eur', 'bridge.no-sepa'),
    refused('bridge.gbp', 'bridge.no-fps'),
    open('bridge.mxn')
)

const NEEDS_IDENTITY: GateState = { kind: 'needs-identity' }
const READY: GateState = { kind: 'ready' }

const withheld = (corridor: DepositCorridor, reason: UnavailableCorridor['reason']): UnavailableCorridor => ({
    railId: `bridge.${corridor.toLowerCase()}`,
    method: corridor,
    country: 'US',
    currency: 'USD',
    reason,
})

const terms = (corridor: DepositCorridor, currency: string): ClaimableCorridor => ({
    railId: `bridge.${corridor.toLowerCase()}`,
    method: corridor,
    country: 'US',
    currency,
    matching: { sender: 'anyone' },
})

const heldUsd: DepositAccountView = {
    id: 'held-usd',
    railId: 'bridge.ach_us',
    country: 'US',
    currency: 'USD',
    isPrimary: true,
    status: 'active',
    matching: { nameOnAccount: 'user', sender: 'anyone' },
    instructions: { accountHolderName: 'Demo User', paymentRails: ['ach_push'] },
}

/**
 * What the backend says to an unverified user today: every Bridge corridor
 * waits on identity verification. Left alone, the USD row reads "Verify ID".
 */
function unverified() {
    const unavailable = emptyCorridorRecord<UnavailableCorridor>()
    for (const corridor of ['SEPA_EU', 'FASTER_PAYMENTS_GB', 'ACH_US', 'SPEI_MX'] as const)
        unavailable[corridor] = withheld(corridor, 'identity-required')
    return {
        accounts: emptyCorridorRecord<DepositAccountView>(),
        claimable: emptyCorridorRecord<ClaimableCorridor>(),
        unavailable,
        gates: corridorRecord(() => NEEDS_IDENTITY),
    }
}

describe('the corridors the engine closes', () => {
    it('closes USD, and only USD, for a Bangladesh resident', () => {
        expect([...corridorsClosedByPaperwork(BANGLADESH)]).toEqual(['ACH_US'])
    })

    it('closes EUR and GBP for a resident of Mali', () => {
        expect([...corridorsClosedByPaperwork(MALI)]).toEqual(['SEPA_EU', 'FASTER_PAYMENTS_GB'])
    })

    // the engine names products only for the features the user picked
    it('reads a product it was not told about as unknown, never refused', () => {
        expect(corridorsClosedByPaperwork(paperwork(open('bridge.eur'))).size).toBe(0)
        expect(corridorsClosedByPaperwork(undefined).size).toBe(0)
    })

    // a bank-wide refusal already reaches the rows through the capability gate, in its own words
    it('leaves bank-wide refusals to the capability gate', () => {
        const uk = paperwork({ ...refused('bridge.usd', 'peanut.uk-bank'), reason: 'uk_resident_blocked' })
        expect(corridorsClosedByPaperwork(uk).size).toBe(0)
    })

    it('never closes a deposit corridor for a card or Manteca refusal', () => {
        const others = paperwork(
            { product: 'rain.card', provider: 'RAIN', available: false, reason: 'geo-blocked' },
            { product: 'manteca.local', provider: 'MANTECA', available: false, reason: 'local_residence_unsupported' }
        )
        expect(corridorsClosedByPaperwork(others).size).toBe(0)
    })
})

describe('the refusal laid over the backend answers', () => {
    it('turns "verify to open USD" into "not available where you live" for a Bangladesh resident', () => {
        const before = unverified()
        const { unavailable } = withPaperworkRefusals(before, corridorsClosedByPaperwork(BANGLADESH))

        expect(unavailable.ACH_US).toMatchObject({ reason: 'not-offered', cause: 'residence-restricted' })
        // the accounts the residence can get still wait on verification
        expect(unavailable.SEPA_EU?.reason).toBe('identity-required')
        expect(unavailable.SPEI_MX?.reason).toBe('identity-required')
    })

    it('withdraws a USD offer the backend made', () => {
        const before = unverified()
        before.claimable.ACH_US = terms('ACH_US', 'USD')
        before.claimable.SEPA_EU = terms('SEPA_EU', 'EUR')

        const { claimable } = withPaperworkRefusals(before, corridorsClosedByPaperwork(BANGLADESH))

        expect(claimable.ACH_US).toBeUndefined()
        expect(claimable.SEPA_EU).toBeDefined()
    })

    it('keeps a USD account the user already holds', () => {
        const before = unverified()
        before.accounts.ACH_US = heldUsd

        const { unavailable } = withPaperworkRefusals(before, corridorsClosedByPaperwork(BANGLADESH))

        expect(unavailable.ACH_US?.reason).toBe('identity-required')
    })

    // Bridge approved USD for 6 of the 85: its own approval outranks the table
    it('keeps a USD rail that already moves money', () => {
        const before = unverified()
        before.gates.ACH_US = READY
        before.claimable.ACH_US = terms('ACH_US', 'USD')

        const { claimable } = withPaperworkRefusals(before, corridorsClosedByPaperwork(BANGLADESH))

        expect(claimable.ACH_US).toBeDefined()
    })

    it('changes nothing when the engine refuses nothing', () => {
        const before = unverified()
        const after = withPaperworkRefusals(before, corridorsClosedByPaperwork(undefined))

        expect(after.claimable).toBe(before.claimable)
        expect(after.unavailable).toBe(before.unavailable)
    })
})

describe('what a Bangladesh resident sees on the account list', () => {
    const rows = () => {
        const before = unverified()
        const overlaid = { ...before, ...withPaperworkRefusals(before, corridorsClosedByPaperwork(BANGLADESH)) }
        const corridors: DepositCorridor[] = ['SEPA_EU', 'FASTER_PAYMENTS_GB', 'ACH_US', 'SPEI_MX']
        return { overlaid, ...virtualAccountRows({ ...overlaid, corridors }, true) }
    }

    it('never offers USD: the row cannot be opened and sorts last', () => {
        const { open } = rows()
        const usd = open.find((row) => row.corridor === 'ACH_US')

        expect(usd?.openable).toBe(false)
        expect(open.filter((row) => row.openable).map((row) => row.corridor)).not.toContain('ACH_US')
        expect(open.findIndex((row) => row.corridor === 'ACH_US')).toBeGreaterThan(
            open.findIndex((row) => row.corridor === 'SPEI_MX')
        )
    })

    it('explains the refusal by residence on tap', () => {
        const { open, overlaid } = rows()
        const usd = open.find((row) => row.corridor === 'ACH_US')!

        expect(closedOpenRow(usd, { unavailable: overlaid.unavailable.ACH_US, hasResidence: true })).toEqual({
            kind: 'residence-restricted',
            corridor: 'ACH_US',
        })
    })
})

describe('a link straight to the USD claim', () => {
    const flow = () => {
        const before = unverified()
        const { claimable, unavailable } = withPaperworkRefusals(before, corridorsClosedByPaperwork(BANGLADESH))
        const props = {
            corridors: ['SEPA_EU', 'FASTER_PAYMENTS_GB', 'ACH_US', 'SPEI_MX'] as DepositCorridor[],
            accounts: before.accounts,
            claimable,
            unavailable,
            gates: before.gates,
            isLoading: false,
            userName: 'Demo User',
            onExit: jest.fn(),
            onClaim: jest.fn(),
            onResolveGate: jest.fn(),
            onRetry: jest.fn(),
            onContactSupport: jest.fn(),
        }
        render(
            <NextIntlClientProvider locale="en" messages={messages}>
                <NuqsTestingAdapter searchParams="?step=claim&corridor=ACH_US">
                    <DepositAccountsFlow {...props} />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        )
        return props
    }

    it('says USD is not available where they live, and offers no verification or claim', () => {
        const props = flow()

        expect(screen.queryByTestId('claim')).not.toBeInTheDocument()
        expect(screen.queryByTestId('corridor-gate-verify')).not.toBeInTheDocument()
        expect(screen.getByText('USD accounts are not available for residents of your country.')).toBeInTheDocument()

        fireEvent.click(screen.getByTestId('corridor-gate-residence-restricted'))
        expect(props.onResolveGate).not.toHaveBeenCalled()
        expect(props.onClaim).not.toHaveBeenCalled()
    })
})

describe('the USD bank row on Accounts and Add money', () => {
    const input = (usd: BankRowsInput['bankChips']['usd'], paperworkClosed = new Set<DepositCorridor>(['ACH_US'])) =>
        ({
            bankChips: { brl: 'unlock', ars: 'unlock', usd, mxn: 'unlock', sepa: 'unlock' },
            restrictions: { banking: false, card: false },
            residenceIso2: 'BD',
            isEuropeResidence: false,
            paperworkClosed,
        }) satisfies BankRowsInput
    const row = (rows: ReturnType<typeof buildBankRows>, key: string) => rows.find((r) => r.labelKey === key)!

    it('offers no Unlock for USD, and says why on tap', () => {
        const rows = buildBankRows(input('unlock'))
        const usd = row(rows, 'usd')

        expect(usd.chip).toBe('notAvailable')
        expect(usd.regionPath).toBeUndefined()
        expect(closedBankRow(usd, false)).toEqual({ kind: 'residence-restricted', corridor: 'ACH_US' })
        // MXN rides the same verification and stays open
        expect(row(rows, 'mxn').chip).toBe('unlock')
    })

    it('keeps a USD rail that already works', () => {
        expect(row(buildBankRows(input('active')), 'usd').chip).toBe('active')
    })

    it('keeps the Unlock where the engine refused nothing', () => {
        expect(row(buildBankRows(input('unlock', new Set())), 'usd').chip).toBe('unlock')
    })
})

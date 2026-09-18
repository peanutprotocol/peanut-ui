/**
 * Brazil opens only for a legal resident of that country.
 *
 * The row is there for everybody, so the tap has to explain the rule and point
 * at the one thing that changes it — the residence on the account. Nationality
 * never decides this: a Brazilian living in Berlin gets the euro account, and
 * a German living in São Paulo gets the Brazilian one.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { DepositAccountsFlow } from '../components/DepositAccountsFlow'
import { corridorRecord, emptyCorridorRecord } from '../rails'
import { residenceAllows } from '../residenceGate'
import type { DepositAccountView, DepositCorridor } from '../types'
import type { GateState } from '@/utils/capability-gate'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    // the screens render the app chrome, and the banner reads the route
    usePathname: () => '/add-money',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
}))

let residenceIso2s: string[] = []
jest.mock('../useResidenceIso2s', () => ({ useResidenceIso2s: () => residenceIso2s }))

jest.mock('../components/DepositAccountsListScreen', () => ({
    DepositAccountsListScreen: () => <div data-testid="hub" />,
}))

const BR_TITLE = messages.depositAccounts.corridors.BANK_TRANSFER_BR.residenceTitle
const READY: GateState = { kind: 'ready' }
const NONE = emptyCorridorRecord<DepositAccountView>()

const flow = (
    corridor: DepositCorridor,
    corridors: DepositCorridor[] = ['SEPA_EU'],
    { step = 'claim', gate = READY }: { step?: string; gate?: GateState } = {}
) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <NuqsTestingAdapter searchParams={`?step=${step}&corridor=${corridor}`}>
                <DepositAccountsFlow
                    corridors={corridors}
                    accounts={NONE}
                    gates={corridorRecord(() => gate)}
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

const onResolveGate = jest.fn()

beforeEach(() => {
    jest.clearAllMocks()
    residenceIso2s = []
})

describe('residenceAllows', () => {
    it('answers on residence alone, and lets an ungated corridor through', () => {
        expect(residenceAllows('BANK_TRANSFER_BR', ['BR'])).toBe(true)
        expect(residenceAllows('BANK_TRANSFER_BR', ['DE'])).toBe(false)
        // a dual resident passes on either country
        expect(residenceAllows('BANK_TRANSFER_AR', ['DE', 'AR'])).toBe(true)
        expect(residenceAllows('SEPA_EU', [])).toBe(true)
        // COP is endorsement-gated, not residence-gated: Bridge opened a Bre-B
        // account for a resident of Portugal.
        expect(residenceAllows('BANK_TRANSFER_CO', ['DE'])).toBe(true)
    })
})

describe('tapping a residence-gated corridor', () => {
    it('names the CPF to a non-resident and offers the residence flow', () => {
        residenceIso2s = ['DE']
        flow('BANK_TRANSFER_BR')

        expect(screen.getByText(BR_TITLE)).toBeInTheDocument()
        // What Bridge asks for is the tax ID; the residence is our pre-check.
        expect(screen.getByText(/tax id \(cpf\)/i)).toBeInTheDocument()

        const cta = screen.getByRole('link', { name: messages.depositAccounts.details.residenceCta })
        expect(cta).toHaveAttribute('href', expect.stringContaining('/profile/accounts-and-payments?open=residence'))
    })

    /**
     * Residence closes the account, not the country. Brazil and Argentina take
     * QR payments from any Peanut balance, so the screen that says no to the
     * account says yes to the thing the user can still do there.
     */
    it('offers the QR payment a non-resident can still make in Brazil', () => {
        residenceIso2s = ['DE']
        flow('BANK_TRANSFER_BR')

        expect(screen.getByText(/pay pix codes in brazil/i)).toBeInTheDocument()
        expect(screen.getByTestId('corridor-qr-pay')).toHaveAttribute('href', '/qr-pay')
    })

    /**
     * Colombia is not one of these corridors. Bridge opened a Bre-B account for
     * a resident of Portugal, so COP behaves like MXN: the rail decides.
     */
    it('opens the COP claim for a non-resident whose rail names the corridor', () => {
        residenceIso2s = ['DE']
        flow('BANK_TRANSFER_CO', ['SEPA_EU', 'BANK_TRANSFER_CO'])

        expect(screen.queryByText(BR_TITLE)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /open cop account/i })).toBeInTheDocument()
    })

    it('sends a COP link back to the list where the user has no such rail', () => {
        residenceIso2s = ['CO']
        flow('BANK_TRANSFER_CO')

        expect(screen.getByTestId('hub')).toBeInTheDocument()
    })

    it('opens the claim for a resident, like any other corridor', () => {
        residenceIso2s = ['BR']
        flow('BANK_TRANSFER_BR', ['SEPA_EU', 'BANK_TRANSFER_BR'])

        expect(screen.queryByText(BR_TITLE)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /open brl account/i })).toBeInTheDocument()
    })

    /**
     * The country list opens Brazil on its corridor now, the same way Portugal
     * opens the euro account. A non-resident arriving that way has to read the
     * rule, not a claim screen that would fail at the provider.
     */
    it('answers a Brazilian country pick with the rule, for a non-resident', () => {
        residenceIso2s = ['DE']
        flow('BANK_TRANSFER_BR', ['SEPA_EU'], { step: 'details' })

        expect(screen.getByText(BR_TITLE)).toBeInTheDocument()
    })

    /**
     * A Brazilian resident whose rail is not enabled yet is not stuck: the Pix
     * top-up is the same money in, minted per payment. Reaching it from the
     * gate screen is what keeps the country pick to one destination.
     */
    it('offers the Pix top-up to a resident waiting on the gate', () => {
        residenceIso2s = ['BR']
        flow('BANK_TRANSFER_BR', ['SEPA_EU'], { step: 'details', gate: { kind: 'needs-enrollment' } })

        expect(screen.getByText(messages.depositAccounts.gate.verifyTitle)).toBeInTheDocument()
        expect(screen.getByTestId('corridor-top-up')).toHaveAttribute('href', '/add-money/brazil/manteca')
    })

    it('leaves an ungated corridor alone whatever the residence says', () => {
        residenceIso2s = ['CO']
        flow('SEPA_EU')

        expect(screen.queryByText(BR_TITLE)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /open eur account/i })).toBeInTheDocument()
    })
})

/**
 * The gate moved off the hub and onto the corridor.
 *
 * A banner over the whole list told a user holding two Ready accounts to
 * verify their identity. Here the reason belongs to the corridor the user
 * tapped, and the button is the one that clears it.
 */
describe('tapping a corridor the gate has not cleared', () => {
    const blocked = (gate: GateState) =>
        render(
            <NextIntlClientProvider locale="en" messages={messages}>
                <NuqsTestingAdapter searchParams="?step=claim&corridor=SEPA_EU">
                    <DepositAccountsFlow
                        corridors={['SEPA_EU']}
                        accounts={NONE}
                        gates={corridorRecord(() => gate)}
                        isLoading={false}
                        userName="Demo User"
                        onExit={() => {}}
                        onClaim={() => {}}
                        onResolveGate={onResolveGate}
                        onRetry={() => {}}
                        onContactSupport={() => {}}
                    />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        )

    it('states the reason and offers the button that clears it', () => {
        blocked({ kind: 'needs-identity' })

        expect(screen.getByText(messages.depositAccounts.gate.verifyTitle)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: messages.depositAccounts.gate.verifyCta }))
        expect(onResolveGate).toHaveBeenCalledWith({ kind: 'needs-identity' })
    })

    it('offers no button where the user can only wait', () => {
        blocked({ kind: 'waiting-on-provider', userMessage: null })

        expect(screen.getByText(messages.depositAccounts.gate.waitTitle)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: messages.depositAccounts.gate.verifyCta })).not.toBeInTheDocument()
    })
})

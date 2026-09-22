/**
 * Residence decides the two Manteca top-ups, Argentina and Brazil, and the flow
 * behind each states the rule. No account a user can open is residence-gated:
 * reais stay on the Pix top-up, and Colombia is gated by a provider review.
 * Nationality never decides anything here.
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

jest.mock('../components/DepositAccountsListScreen', () => ({
    DepositAccountsListScreen: () => <div data-testid="hub" />,
}))

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
})

describe('residenceAllows', () => {
    it('answers on residence alone, and lets an ungated corridor through', () => {
        expect(residenceAllows('BANK_TRANSFER_AR', ['AR'])).toBe(true)
        expect(residenceAllows('BANK_TRANSFER_AR', ['DE'])).toBe(false)
        // a dual resident passes on either country
        expect(residenceAllows('BANK_TRANSFER_AR', ['DE', 'AR'])).toBe(true)
        // Brazil: a client-side pre-check where a Brazilian residence stands in
        // for the CPF the account needs; an unknown residence fails closed
        expect(residenceAllows('PIX_BR', ['BR'])).toBe(true)
        expect(residenceAllows('PIX_BR', ['PT'])).toBe(false)
        expect(residenceAllows('PIX_BR', [])).toBe(false)
        expect(residenceAllows('SEPA_EU', [])).toBe(true)
        // COP is endorsement-gated, not residence-gated: Bridge opened a Bre-B
        // account for a resident of Portugal.
        expect(residenceAllows('BANK_TRANSFER_CO', ['DE'])).toBe(true)
    })
})

describe('opening a corridor', () => {
    /**
     * Bridge opened a Bre-B account for a resident of Portugal, so COP behaves
     * like MXN: the rail decides, never the residence.
     */
    it('opens the COP claim for a user whose rail names the corridor', () => {
        flow('BANK_TRANSFER_CO', ['SEPA_EU', 'BANK_TRANSFER_CO'])

        expect(screen.getByRole('button', { name: /open cop account/i })).toBeInTheDocument()
    })

    /**
     * The typed parser answers its default for an id it does not know, so a
     * link naming a corridor that has left the catalogue opened the euro
     * account's screens.
     */
    it.each([['claim'], ['details']])('sends a %s link naming a removed corridor to the list', (step) => {
        flow('BANK_TRANSFER_BR' as DepositCorridor, ['SEPA_EU'], { step })

        expect(screen.getByTestId('hub')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /open eur account/i })).not.toBeInTheDocument()
    })

    it('sends a COP link back to the list where the user has no such rail', () => {
        flow('BANK_TRANSFER_CO')

        expect(screen.getByTestId('hub')).toBeInTheDocument()
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

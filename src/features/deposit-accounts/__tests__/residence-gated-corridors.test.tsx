/**
 * Brazil and Colombia open only for a legal resident of that country.
 *
 * The row is there for everybody, so the tap has to explain the rule and point
 * at the one thing that changes it — the residence on the account. Nationality
 * never decides this: a Brazilian living in Berlin gets the euro account, and
 * a German living in São Paulo gets the Brazilian one.
 */
import { render, screen } from '@testing-library/react'
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

const READY: GateState = { kind: 'ready' }
const NONE = emptyCorridorRecord<DepositAccountView>()

const flow = (corridor: DepositCorridor, corridors: DepositCorridor[] = ['SEPA_EU']) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <NuqsTestingAdapter searchParams={`?step=claim&corridor=${corridor}`}>
                <DepositAccountsFlow
                    corridors={corridors}
                    accounts={NONE}
                    gates={corridorRecord(() => READY)}
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

beforeEach(() => {
    residenceIso2s = []
})

describe('residenceAllows', () => {
    it('answers on residence alone, and lets an ungated corridor through', () => {
        expect(residenceAllows('BANK_TRANSFER_BR', ['BR'])).toBe(true)
        expect(residenceAllows('BANK_TRANSFER_BR', ['DE'])).toBe(false)
        // a dual resident passes on either country
        expect(residenceAllows('BANK_TRANSFER_CO', ['DE', 'CO'])).toBe(true)
        expect(residenceAllows('SEPA_EU', [])).toBe(true)
    })
})

describe('tapping a residence-gated corridor', () => {
    it('explains the rule to a non-resident and offers the residence flow', () => {
        residenceIso2s = ['DE']
        flow('BANK_TRANSFER_BR')

        expect(screen.getByText(messages.depositAccounts.details.residenceTitle)).toBeInTheDocument()
        expect(
            screen.getByText(messages.depositAccounts.corridors.BANK_TRANSFER_BR.residenceRequired)
        ).toBeInTheDocument()

        const cta = screen.getByRole('link', { name: messages.depositAccounts.details.residenceCta })
        expect(cta).toHaveAttribute('href', expect.stringContaining('/profile/identity-verification?open=residence'))
    })

    it('opens the claim for a resident, like any other corridor', () => {
        residenceIso2s = ['BR']
        flow('BANK_TRANSFER_BR', ['SEPA_EU', 'BANK_TRANSFER_BR'])

        expect(screen.queryByText(messages.depositAccounts.details.residenceTitle)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /open brl account/i })).toBeInTheDocument()
    })

    it('leaves an ungated corridor alone whatever the residence says', () => {
        residenceIso2s = ['CO']
        flow('SEPA_EU')

        expect(screen.queryByText(messages.depositAccounts.details.residenceTitle)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /open eur account/i })).toBeInTheDocument()
    })
})

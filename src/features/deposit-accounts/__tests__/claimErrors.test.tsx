/**
 * A failed claim in the user's language.
 *
 * The API answers in English in every locale, and that sentence used to be
 * rendered verbatim under a localized title. The wire code picks the sentence
 * now; the backend's own message stays in the analytics event and Sentry.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { DepositAccountsFlow } from '../components/DepositAccountsFlow'
import { claimErrorKey } from '../claimErrors'
import { corridorRecord, emptyCorridorRecord } from '../rails'
import type { DepositAccountView } from '../types'
import type { DepositClaimError } from '../useDepositAccounts'
import type { GateState } from '@/utils/capability-gate'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    // the screens render the app chrome, and the banner reads the route
    usePathname: () => '/add-money',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
}))
jest.mock('../useResidenceIso2s', () => ({ useResidenceIso2s: () => [] }))
jest.mock('../components/DepositAccountsListScreen', () => ({
    DepositAccountsListScreen: () => <div data-testid="hub" />,
}))

const BACKEND_SENTENCE = 'Could not open the account'

const claimFailedWith = (claimError: DepositClaimError, onContactSupport: jest.Mock = jest.fn()) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <NuqsTestingAdapter searchParams="?step=claim&corridor=SEPA_EU">
                <DepositAccountsFlow
                    corridors={['SEPA_EU']}
                    accounts={emptyCorridorRecord<DepositAccountView>()}
                    gates={corridorRecord(() => ({ kind: 'ready' }) as GateState)}
                    isLoading={false}
                    userName="Demo User"
                    claimError={claimError}
                    onExit={() => {}}
                    onClaim={() => {}}
                    onResolveGate={() => {}}
                    onRetry={() => {}}
                    onContactSupport={onContactSupport}
                />
            </NuqsTestingAdapter>
        </NextIntlClientProvider>
    )

describe('claimErrorKey', () => {
    it('reads the wire code, falls back to the status, then to the generic sentence', () => {
        expect(claimErrorKey('DEPOSIT_ACCOUNT_LIMIT', 409)).toBe('accountLimit')
        expect(claimErrorKey('DEPOSIT_ACCOUNTS_NOT_AVAILABLE', 403)).toBe('notAvailable')
        // the residence refusal every Bridge money route sends: a bare 403
        expect(claimErrorKey(undefined, 403)).toBe('residenceRestricted')
        // a refusal with no code: retry may or may not clear it
        expect(claimErrorKey(undefined, 409)).toBe('refused')
        expect(claimErrorKey('SOMETHING_NEW', 500)).toBe('generic')
        expect(claimErrorKey(undefined, undefined)).toBe('generic')
    })
})

describe('the claim error a user reads', () => {
    it('states the known refusal in their own language', () => {
        claimFailedWith({
            corridor: 'SEPA_EU',
            message: BACKEND_SENTENCE,
            code: 'DEPOSIT_ACCOUNT_LIMIT',
            status: 409,
            unavailable: false,
        })

        expect(screen.getByText(messages.depositAccounts.errors.accountLimit)).toBeInTheDocument()
        expect(screen.queryByText(BACKEND_SENTENCE)).not.toBeInTheDocument()
    })

    it('falls back to the generic sentence for a code the app does not know', () => {
        claimFailedWith({
            corridor: 'SEPA_EU',
            message: BACKEND_SENTENCE,
            code: 'A_CODE_SHIPPED_AFTER_THIS_BUILD',
            status: 500,
            unavailable: false,
        })

        expect(screen.getByText(messages.depositAccounts.errors.generic)).toBeInTheDocument()
        expect(screen.queryByText(BACKEND_SENTENCE)).not.toBeInTheDocument()
    })

    /**
     * The API's "contact support" refusals are 409s with no code. They used to
     * read "Try again in a moment", which no number of taps would clear.
     */
    it('offers support on a refusal a retry may never clear', () => {
        const onContactSupport = jest.fn()
        claimFailedWith(
            { corridor: 'SEPA_EU', message: BACKEND_SENTENCE, status: 409, unavailable: false },
            onContactSupport
        )

        expect(screen.getByText(messages.depositAccounts.errors.refused)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: messages.depositAccounts.gate.supportCta }))
        expect(onContactSupport).toHaveBeenCalledWith('SEPA_EU', 'blocked')
    })

    it('offers no support button on a failure worth one more try', () => {
        claimFailedWith({ corridor: 'SEPA_EU', message: BACKEND_SENTENCE, status: 503, unavailable: false })

        expect(screen.getByText(messages.depositAccounts.errors.generic)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: messages.depositAccounts.gate.supportCta })).not.toBeInTheDocument()
    })

    it('names the residence rule on the refusal that carries no code', () => {
        claimFailedWith({ corridor: 'SEPA_EU', message: BACKEND_SENTENCE, status: 403, unavailable: false })

        expect(screen.getByText(messages.depositAccounts.errors.residenceRestricted)).toBeInTheDocument()
    })
})

import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { DepositAccountsFlow } from '../components/DepositAccountsFlow'
import { DepositAccountsListScreen } from '../components/DepositAccountsListScreen'
import type { DepositAccount, DepositCorridor } from '../types'
import type { GateState } from '@/utils/capability-gate'

const READY: GateState = { kind: 'ready' }

const NONE: Record<DepositCorridor, DepositAccount | undefined> = {
    ACH_US: undefined,
    SEPA_EU: undefined,
    FASTER_PAYMENTS_GB: undefined,
    SPEI_MX: undefined,
    PIX_BR: undefined,
    BANK_TRANSFER_AR: undefined,
}

const list = (isLoading: boolean) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <DepositAccountsListScreen
                accounts={NONE}
                isLoading={isLoading}
                gate={READY}
                onBack={() => {}}
                onOpen={() => {}}
                onResolveGate={() => {}}
            />
        </NextIntlClientProvider>
    )

/**
 * The corridors are a local catalogue and the accounts are a network call, so
 * the rows paint before anything is known about them. What the screen says in
 * that gap has to be true, because the alternative is a wrong status that
 * corrects itself a moment later.
 */
describe('DepositAccountsListScreen', () => {
    it('claims nothing about a corridor while the accounts are still loading', () => {
        list(true)
        expect(screen.queryByText(/not set up yet/i)).not.toBeInTheDocument()
    })

    it('says a corridor is not set up once it knows that is true', () => {
        list(false)
        expect(screen.getAllByText(/not set up yet/i).length).toBeGreaterThan(0)
    })

    it('does not open a corridor whose state is not known yet', () => {
        const { container } = list(true)
        const row = container.querySelector('[data-testid="deposit-account-SEPA_EU"]')
        expect(row).toHaveAttribute('aria-disabled', 'true')
    })
})

/**
 * Which screen is right depends on a network answer. Before it arrives, a
 * missing account is indistinguishable from one that was never claimed — so
 * the flow must not offer to open an account the user may already hold.
 */
describe('DepositAccountsFlow while the accounts are loading', () => {
    const flow = (isLoading: boolean) =>
        render(
            <NextIntlClientProvider locale="en" messages={messages}>
                <NuqsTestingAdapter searchParams="?screen=details&corridor=SEPA_EU">
                    <DepositAccountsFlow
                        accounts={NONE}
                        isLoading={isLoading}
                        userName="Demo User"
                        gate={READY}
                        onExit={() => {}}
                        onClaim={() => {}}
                        onResolveGate={() => {}}
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
})

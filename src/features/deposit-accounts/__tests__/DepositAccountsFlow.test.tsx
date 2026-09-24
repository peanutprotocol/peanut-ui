import { fireEvent, render, screen } from '@testing-library/react'
import { DepositAccountsFlow, type DepositAccountsFlowProps } from '../components/DepositAccountsFlow'
import { corridorRecord, emptyCorridorRecord } from '../rails'
import type { DepositAccountView } from '../types'

// the step the flow opens on; jest lets a mock factory read a `mock`-prefixed variable
let mockInitialStep = 'claim'
jest.mock('nuqs', () => ({
    ...jest.requireActual('nuqs'),
    useQueryStates: () => {
        const React = jest.requireActual('react')
        const [params, setParams] = React.useState({ step: mockInitialStep, corridor: 'SEPA_EU', screen: null })
        return [params, (next: object) => setParams((current: object) => ({ ...current, ...next }))]
    },
    // the raw `?corridor=` read, which only matters for an id the catalogue does not know
    useQueryState: () => [null, jest.fn()],
}))
jest.mock('../analytics', () => ({ trackDetailsViewed: jest.fn(), trackGateBlocked: jest.fn() }))
// residence only decides the BR/CO corridors, which this file never renders
jest.mock('../useResidenceIso2s', () => ({ useResidenceIso2s: () => [] }))
jest.mock('../useDepositAccountCopy', () => ({
    useDepositAccountCopy: () => ({ t: (key: string) => key, railName: () => 'SEPA' }),
}))
jest.mock('../components/ClaimAccountScreen', () => ({
    ClaimAccountScreen: ({ onClaim }: { onClaim: () => void }) => <button onClick={onClaim}>Open account</button>,
}))
jest.mock('../components/DepositAccountDetailsScreen', () => ({
    DepositAccountDetailsScreen: ({ onBack }: { onBack: () => void }) => (
        <div>
            Account details
            <button onClick={onBack}>Back</button>
        </div>
    ),
}))
jest.mock('../components/DepositAccountsListScreen', () => ({
    DepositAccountsListScreen: ({ onOpen }: { onOpen: (corridor: string) => void }) => (
        <div>
            Account list
            <button onClick={() => onOpen('SEPA_EU')}>Open SEPA</button>
        </div>
    ),
}))
jest.mock('../components/AccountOpenedScreen', () => ({
    AccountOpenedScreen: ({ onContinue }: { onContinue: () => void }) => (
        <div>
            Account opened
            <button onClick={onContinue}>Continue</button>
        </div>
    ),
}))

const active: DepositAccountView = {
    id: 'account-test',
    railId: 'bridge.sepa_eu',
    country: 'EU',
    currency: 'EUR',
    isPrimary: true,
    status: 'active',
    matching: { nameOnAccount: 'user', sender: 'anyone' },
    instructions: { accountHolderName: 'Demo User', paymentRails: ['sepa'] },
}

function props(account?: DepositAccountView): DepositAccountsFlowProps {
    return {
        corridors: ['SEPA_EU'],
        // built from the catalogue, so a new corridor does not break this file
        accounts: { ...emptyCorridorRecord<DepositAccountView>(), SEPA_EU: account },
        gates: corridorRecord(() => ({ kind: 'ready' as const })),
        userName: 'Demo User',
        onExit: jest.fn(),
        onClaim: jest.fn(),
        onResolveGate: jest.fn(),
        onRetry: jest.fn(),
        onContactSupport: jest.fn(),
    }
}

beforeEach(() => {
    mockInitialStep = 'claim'
})

describe('account opening celebration', () => {
    it('waits for active instructions and a ready gate, then dismisses into details', () => {
        const initial = props()
        const { rerender } = render(<DepositAccountsFlow {...initial} />)
        fireEvent.click(screen.getByRole('button', { name: 'Open account' }))
        expect(initial.onClaim).toHaveBeenCalledWith('SEPA_EU')
        expect(screen.queryByText('Account opened')).not.toBeInTheDocument()

        rerender(<DepositAccountsFlow {...props({ ...active, status: 'provisioning' })} />)
        expect(screen.getByText('Account details')).toBeInTheDocument()
        expect(screen.queryByText('Account opened')).not.toBeInTheDocument()

        rerender(<DepositAccountsFlow {...props({ ...active, instructions: undefined })} />)
        expect(screen.queryByText('Account opened')).not.toBeInTheDocument()

        const blocked = props(active)
        blocked.gates.SEPA_EU = { kind: 'needs-identity' }
        rerender(<DepositAccountsFlow {...blocked} />)
        expect(screen.queryByText('Account opened')).not.toBeInTheDocument()

        rerender(<DepositAccountsFlow {...props(active)} />)
        expect(screen.getByText('Account opened')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(screen.getByText('Account details')).toBeInTheDocument()
        rerender(<DepositAccountsFlow {...props({ ...active })} />)
        expect(screen.queryByText('Account opened')).not.toBeInTheDocument()
    })

    it('opens existing accounts without celebrating or provisioning again', () => {
        const existing = props(active)
        render(<DepositAccountsFlow {...existing} />)
        expect(screen.getByText('Account details')).toBeInTheDocument()
        expect(screen.queryByText('Account opened')).not.toBeInTheDocument()
        expect(existing.onClaim).not.toHaveBeenCalled()
    })
})

/**
 * The rollout flag gates opening an account, never reading one. With claims
 * off a link to the claim step lands on the list, and the details of an
 * account the user already holds render as they always do.
 */
describe('the flow while claims are off', () => {
    it('refuses the claim step and never opens an account', () => {
        const closed = { ...props(), claimsEnabled: false }
        render(<DepositAccountsFlow {...closed} />)

        expect(screen.getByText('Account list')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Open account' })).not.toBeInTheDocument()
        expect(closed.onClaim).not.toHaveBeenCalled()
    })

    it('still serves the details of an account the user holds', () => {
        render(<DepositAccountsFlow {...{ ...props(active), claimsEnabled: false }} />)

        expect(screen.getByText('Account details')).toBeInTheDocument()
    })
})

/**
 * Accounts and payments links straight to the details step with a returnTo.
 * Back from there has to leave the flow, not land on the add money list.
 */
describe('back from the details step', () => {
    it('leaves the flow when the details were opened directly', () => {
        mockInitialStep = 'details'
        const direct = props(active)
        render(<DepositAccountsFlow {...direct} />)

        fireEvent.click(screen.getByRole('button', { name: 'Back' }))
        expect(direct.onExit).toHaveBeenCalled()
    })

    it('returns to the list when the user came from it', () => {
        mockInitialStep = 'list'
        const fromList = props(active)
        render(<DepositAccountsFlow {...fromList} />)

        fireEvent.click(screen.getByRole('button', { name: 'Open SEPA' }))
        fireEvent.click(screen.getByRole('button', { name: 'Back' }))
        expect(screen.getByText('Account list')).toBeInTheDocument()
        expect(fromList.onExit).not.toHaveBeenCalled()
    })
})

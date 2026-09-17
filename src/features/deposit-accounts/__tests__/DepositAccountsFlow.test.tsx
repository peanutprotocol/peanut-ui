import { fireEvent, render, screen } from '@testing-library/react'
import { DepositAccountsFlow, type DepositAccountsFlowProps } from '../components/DepositAccountsFlow'
import type { DepositAccountView } from '../types'

jest.mock('nuqs', () => ({
    ...jest.requireActual('nuqs'),
    useQueryStates: () => {
        const React = jest.requireActual('react')
        const [params, setParams] = React.useState({ step: 'claim', corridor: 'SEPA_EU', screen: null })
        return [params, (next: object) => setParams((current: object) => ({ ...current, ...next }))]
    },
}))
jest.mock('../analytics', () => ({ trackDetailsViewed: jest.fn(), trackGateBlocked: jest.fn() }))
jest.mock('../useDepositAccountCopy', () => ({
    useDepositAccountCopy: () => ({ t: (key: string) => key, railName: () => 'SEPA' }),
}))
jest.mock('../components/ClaimAccountScreen', () => ({
    ClaimAccountScreen: ({ onClaim }: { onClaim: () => void }) => <button onClick={onClaim}>Open account</button>,
}))
jest.mock('../components/DepositAccountDetailsScreen', () => ({
    DepositAccountDetailsScreen: () => <div>Account details</div>,
}))
jest.mock('../components/DepositAccountsListScreen', () => ({
    DepositAccountsListScreen: () => <div>Account list</div>,
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
        accounts: {
            SEPA_EU: account,
            ACH_US: undefined,
            FASTER_PAYMENTS_GB: undefined,
            SPEI_MX: undefined,
            PIX_BR: undefined,
            BANK_TRANSFER_AR: undefined,
        },
        gates: {
            SEPA_EU: { kind: 'ready' },
            ACH_US: { kind: 'ready' },
            FASTER_PAYMENTS_GB: { kind: 'ready' },
            SPEI_MX: { kind: 'ready' },
            PIX_BR: { kind: 'ready' },
            BANK_TRANSFER_AR: { kind: 'ready' },
        },
        userName: 'Demo User',
        onExit: jest.fn(),
        onClaim: jest.fn(),
        onResolveGate: jest.fn(),
        onRetry: jest.fn(),
        onContactSupport: jest.fn(),
    }
}

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

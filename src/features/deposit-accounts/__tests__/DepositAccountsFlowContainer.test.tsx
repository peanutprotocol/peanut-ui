import { fireEvent, render, screen } from '@testing-library/react'
import { DepositAccountsFlowContainer } from '../components/DepositAccountsFlowContainer'
import { corridorRecord, emptyCorridorRecord } from '../rails'
import type { DepositAccountView } from '../types'

/**
 * The rollout flag is the rollback lever. Turning it off used to disable the
 * accounts read, so a user who had already handed out an IBAN could not see
 * it while deposits kept crediting. The container now reads regardless of the
 * flag and passes the flag down as "may a new account be opened".
 */
let depositAccountsEnabled = true
jest.mock('../useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => depositAccountsEnabled,
}))

const held: DepositAccountView = {
    id: 'acct-eur',
    railId: 'bridge.sepa_eu',
    country: 'DE',
    currency: 'EUR',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: 'anyone' },
    instructions: { accountHolderName: 'Ana Pérez', iban: 'DE89', paymentRails: ['sepa'] },
}
const mockUseDepositAccounts = jest.fn()
jest.mock('../useDepositAccounts', () => ({
    useDepositAccounts: (...args: unknown[]) => mockUseDepositAccounts(...args),
}))

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { fullName: 'Ana Pérez' } } }) }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ openSupportWithMessage: jest.fn() }) }))
const mockPush = jest.fn()
let mockReturnTo = ''
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}))
jest.mock('nuqs', () => ({
    parseAsString: {},
    useQueryState: () => [mockReturnTo || null, jest.fn()],
}))
jest.mock('../useResidenceIso2s', () => ({ useResidenceIso2s: () => [] }))
const mockVerifyCorridor = jest.fn()
jest.mock('../useDepositGateRemediation', () => ({
    useDepositGateRemediation: () => ({ resolveGate: jest.fn(), verifyCorridor: mockVerifyCorridor, modals: null }),
}))
jest.mock('../useEndorsementReview', () => ({ useEndorsementReview: () => undefined }))
// the flow itself has its own tests; here only what the container hands it matters
jest.mock('../components/DepositAccountsFlow', () => ({
    DepositAccountsFlow: (props: {
        claimsEnabled?: boolean
        corridors: string[]
        onTopUp: (corridor: 'SEPA_EU') => void
    }) => (
        <div data-testid="flow" data-claims-enabled={String(props.claimsEnabled)}>
            {props.corridors.join(',')}
            <button onClick={() => props.onTopUp('SEPA_EU')}>Top up</button>
        </div>
    ),
}))

beforeEach(() => {
    mockPush.mockClear()
    mockReturnTo = ''
    mockUseDepositAccounts.mockReset().mockReturnValue({
        corridors: ['SEPA_EU'],
        accounts: { ...emptyCorridorRecord<DepositAccountView>(), SEPA_EU: held },
        claimable: emptyCorridorRecord(),
        unavailable: emptyCorridorRecord(),
        slotsHeld: 1,
        gates: corridorRecord(() => ({ kind: 'ready' as const })),
        isLoading: false,
        isError: false,
        claim: jest.fn(),
        refetch: jest.fn(),
    })
})

describe('DepositAccountsFlowContainer while the rollout flag is off', () => {
    it('still reads the accounts the user holds, and hands the flow the held corridor', () => {
        depositAccountsEnabled = false
        render(<DepositAccountsFlowContainer onExit={() => {}} />)

        // the read is not switched off by the flag
        // a claim that needs a verification is handed to the one corridor path
        expect(mockUseDepositAccounts).toHaveBeenCalledWith({ onVerificationRequired: mockVerifyCorridor })
        expect(screen.getByTestId('flow')).toHaveTextContent('SEPA_EU')
        expect(screen.getByTestId('flow')).toHaveAttribute('data-claims-enabled', 'false')
    })

    it('lets the flow open accounts once the flag is on', () => {
        depositAccountsEnabled = true
        render(<DepositAccountsFlowContainer onExit={() => {}} />)

        expect(screen.getByTestId('flow')).toHaveAttribute('data-claims-enabled', 'true')
    })
})

describe('bank top-up return navigation', () => {
    it('preserves the card funding destination through the bank hub', () => {
        mockReturnTo = '/card?card_step=funding'
        render(<DepositAccountsFlowContainer onExit={() => {}} />)
        fireEvent.click(screen.getByRole('button', { name: 'Top up' }))
        const topUp = new URL(mockPush.mock.calls[0][0], 'https://peanut.me')
        const bankHub = new URL(topUp.searchParams.get('returnTo')!, 'https://peanut.me')
        expect(bankHub.pathname).toBe('/add-money')
        expect(bankHub.searchParams.get('method')).toBe('bank')
        expect(bankHub.searchParams.get('returnTo')).toBe('/card?card_step=funding')
    })
    it('does not propagate an external return destination', () => {
        mockReturnTo = 'https://example.com'
        render(<DepositAccountsFlowContainer onExit={() => {}} />)
        fireEvent.click(screen.getByRole('button', { name: 'Top up' }))
        const topUp = new URL(mockPush.mock.calls[0][0], 'https://peanut.me')
        expect(topUp.searchParams.get('returnTo')).toBe('/add-money?method=bank')
    })
})

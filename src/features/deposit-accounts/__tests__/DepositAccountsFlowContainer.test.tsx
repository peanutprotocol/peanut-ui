import { render, screen } from '@testing-library/react'
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
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('../useResidenceIso2s', () => ({ useResidenceIso2s: () => [] }))
jest.mock('../useDepositGateRemediation', () => ({
    useDepositGateRemediation: () => ({ resolveGate: jest.fn(), modals: null }),
}))
jest.mock('../useEndorsementReview', () => ({ useEndorsementReview: () => undefined }))
// the flow itself has its own tests; here only what the container hands it matters
jest.mock('../components/DepositAccountsFlow', () => ({
    DepositAccountsFlow: (props: { claimsEnabled?: boolean; corridors: string[] }) => (
        <div data-testid="flow" data-claims-enabled={String(props.claimsEnabled)}>
            {props.corridors.join(',')}
        </div>
    ),
}))

beforeEach(() => {
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
        expect(mockUseDepositAccounts).toHaveBeenCalledWith()
        expect(screen.getByTestId('flow')).toHaveTextContent('SEPA_EU')
        expect(screen.getByTestId('flow')).toHaveAttribute('data-claims-enabled', 'false')
    })

    it('lets the flow open accounts once the flag is on', () => {
        depositAccountsEnabled = true
        render(<DepositAccountsFlowContainer onExit={() => {}} />)

        expect(screen.getByTestId('flow')).toHaveAttribute('data-claims-enabled', 'true')
    })
})

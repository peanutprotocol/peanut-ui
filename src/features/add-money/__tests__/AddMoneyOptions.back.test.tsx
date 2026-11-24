/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import { AddMoneyOptions } from '../AddMoneyOptions'

const mockReturnTo = jest.fn()
jest.mock('@/hooks/useSafeBack', () => ({ useReturnTo: (origin: string) => () => mockReturnTo(origin) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ onPrev }: { onPrev: () => void }) => <button aria-label="Back" onClick={onPrev} />,
}))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isTerminalFailure: false }) }))
const loading = new Proxy({}, { get: () => ({ kind: 'loading' }) })
jest.mock('../useAddMoneyReadiness', () => ({
    useAddMoneyReadiness: () => ({
        ready: { account: [], transfer: [] },
        pickerMethods: [],
        isLoading: false,
        residenceIso2s: [],
        standingEnabled: true,
        topUpGates: loading,
    }),
}))
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    useDepositAccounts: () => ({
        isLoading: false,
        isError: false,
        corridors: [],
        accounts: {},
        claimable: {},
        gates: loading,
        unavailable: {},
    }),
}))

const renderAt = (search: string) => {
    const Url = withNuqsTestingAdapter({ searchParams: search })
    return renderWithIntl(
        <Url>
            <AddMoneyOptions />
        </Url>
    )
}

beforeEach(() => mockReturnTo.mockClear())

// TASK-25079: Home → Add → Bank accounts → Back opened /add-money ("More ways"), not Home.
// The Home drawer is the one entry that sends no returnTo; the picker always sends one.
it('goes back to Home when the entry sent no returnTo', () => {
    renderAt('?method=account')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(mockReturnTo).toHaveBeenCalledWith('/home')
})

it('goes back to the picker that sent the user here', () => {
    renderAt('?method=account&returnTo=%2Fadd-money')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(mockReturnTo).toHaveBeenCalledWith('/add-money')
})

import { render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import WithdrawBankPage from '../page'
import { getCountryFromPath, railJurisdictionForBank } from '@/utils/bridge.utils'

let mockParams: Record<string, string> = {}
jest.mock('next/navigation', () => ({ useParams: () => mockParams }))
const mockGate = jest.fn()
jest.mock('@/features/paperwork-verification/KycFeatureActivationGate', () => ({
    KycFeatureActivationGate: (props: { scope?: unknown; children: React.ReactNode }) => {
        mockGate(props.scope)
        return <>{props.children}</>
    },
}))
jest.mock('@/features/withdraw/views/BridgeBankWithdrawView', () => ({
    __esModule: true,
    default: () => <div data-testid="bank-withdraw-view" />,
}))

const usScope = { channel: 'bank', country: railJurisdictionForBank(getCountryFromPath('us')?.id) }

beforeEach(() => {
    mockGate.mockClear()
    mockParams = {}
})

it('reads the country from the route', () => {
    mockParams = { country: 'us' }
    render(
        <NuqsTestingAdapter>
            <WithdrawBankPage />
        </NuqsTestingAdapter>
    )
    expect(screen.getByTestId('bank-withdraw-view')).toBeInTheDocument()
    expect(mockGate).toHaveBeenLastCalledWith(usScope)
})

it('reads the country from the query on the native static withdraw view', () => {
    render(
        <NuqsTestingAdapter searchParams={{ country: 'us', view: 'bank' }}>
            <WithdrawBankPage />
        </NuqsTestingAdapter>
    )
    expect(screen.getByTestId('bank-withdraw-view')).toBeInTheDocument()
    expect(mockGate).toHaveBeenLastCalledWith(usScope)
})

it('renders without a country instead of throwing', () => {
    render(
        <NuqsTestingAdapter>
            <WithdrawBankPage />
        </NuqsTestingAdapter>
    )
    expect(screen.getByTestId('bank-withdraw-view')).toBeInTheDocument()
})

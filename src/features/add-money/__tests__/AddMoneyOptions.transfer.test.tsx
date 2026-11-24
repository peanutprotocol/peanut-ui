/** @jest-environment jsdom */
import { fireEvent, screen, within } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import { AddMoneyOptions } from '../AddMoneyOptions'

jest.mock('@/hooks/useSafeBack', () => ({ useReturnTo: () => jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isTerminalFailure: false }) }))
const loading = new Proxy({}, { get: () => ({ kind: 'loading' }) })
let mockResidence: string[] = []
let mockPickerMethods: string[] = []
jest.mock('../useAddMoneyReadiness', () => ({
    useAddMoneyReadiness: () => ({
        ready: { account: [], transfer: [] },
        pickerMethods: mockPickerMethods,
        isLoading: false,
        residenceIso2s: mockResidence,
        standingEnabled: true,
        topUpGates: loading,
    }),
}))
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    useDepositAccounts: () => ({ isLoading: false, isError: false, accounts: {}, gates: loading, unavailable: {} }),
}))

const showTransferList = (residence: string[], pickerMethods: string[]) => {
    mockResidence = residence
    mockPickerMethods = pickerMethods
    const Url = withNuqsTestingAdapter({ searchParams: '?method=transfer' })
    renderWithIntl(
        <Url>
            <AddMoneyOptions />
        </Url>
    )
    fireEvent.click(screen.getByTestId('other-countries-toggle'))
}
const countryList = () => within(screen.getByTestId('add-money-options-list'))

// The owner, 24 Nov (TASK-25350): the peso top-up has its own ARS row on the picker, so the one-time bank
// transfer does not offer it a second time
it('drops the ARS row and Argentina for a resident who has the ARS row on the picker', () => {
    showTransferList(['AR'], ['ars', 'account', 'transfer', 'crypto'])
    expect(screen.queryByTestId('add-money-option-ARS')).not.toBeInTheDocument()
    expect(countryList().queryByRole('button', { name: /Argentina/ })).not.toBeInTheDocument()
    // bank transfers in other currencies stay
    expect(screen.getByTestId('add-money-option-EUR')).toBeInTheDocument()
    expect(countryList().getByRole('button', { name: /Germany/ })).toBeInTheDocument()
})

it('keeps the ARS row and Argentina where the picker has no ARS row', () => {
    showTransferList(['AR'], ['account', 'transfer', 'crypto'])
    expect(screen.getByTestId('add-money-option-ARS')).toBeInTheDocument()
    expect(countryList().getByRole('button', { name: /Argentina/ })).toBeInTheDocument()
})

// what the not-offered row opens (the residence explanation and QR pay): AddMoneyArgentinaCountry.acceptance.test.tsx
it('keeps the not-offered ARS row and Argentina for a resident of another country', () => {
    showTransferList(['DE'], ['account', 'transfer', 'crypto'])
    expect(screen.getByTestId('add-money-option-ARS')).toHaveTextContent(/not available/i)
    expect(countryList().getByRole('button', { name: /Argentina/ })).toHaveTextContent(/not available/i)
})

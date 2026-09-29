/**
 * The withdraw hub lists one section per rail the user can still pick. Send →
 * Bank already picked bank, so the crypto address book must not follow it onto
 * the screen (QA 2026-09-24, QA-30).
 */
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import SavedAccountsView from '../SavedAccountsView'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/withdraw/components/AddressBook/SavedAddressesList', () => ({
    __esModule: true,
    default: () => <div>address book</div>,
}))

const renderHub = (onCryptoClick?: () => void) =>
    render(
        <SavedAccountsView
            pageTitle="Send"
            onPrev={() => {}}
            savedAccounts={[]}
            onAccountClick={() => {}}
            onSelectNewMethodClick={() => {}}
            savedAddresses={[]}
            railSections
            onCryptoClick={onCryptoClick}
        />,
        { wrapper: IntlWrapper }
    )

describe('SavedAccountsView — rail sections', () => {
    it('bank already chosen: the bank section only', () => {
        renderHub()
        expect(screen.getByText('Add new bank account')).toBeInTheDocument()
        expect(screen.queryByText('Add new crypto address')).not.toBeInTheDocument()
        expect(screen.queryByTestId('withdraw-add-crypto')).not.toBeInTheDocument()
    })

    it('no rail chosen: both sections', () => {
        renderHub(() => {})
        expect(screen.getByTestId('withdraw-add-bank')).toBeInTheDocument()
        expect(screen.getByTestId('withdraw-add-crypto')).toBeInTheDocument()
    })
})

/**
 * RequestPotActionList — which bank row a payer sees, and in what order.
 *
 * The generic "Bank" method funds a Peanut balance first, so a signed-out payer
 * who taps it lands in signup. When the requester shares bank details, a
 * signed-out payer can pay with no account: that row leads and the generic one
 * is hidden.
 */
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock('@/components/Global/ActionModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/payments/shared/components/SendWithPeanutCta', () => ({
    __esModule: true,
    default: () => <button>Pay with Peanut</button>,
}))

let mockAuth: { user: unknown; isFetchingUser: boolean }
jest.mock('@/context/authContext', () => ({ useAuth: () => mockAuth }))

jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ hasSufficientSpendableBalance: () => false, isFetchingSpendableBalance: false }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ canDo: () => true }) }))
jest.mock('@/hooks/useDetermineBankRequestType', () => ({
    BankRequestType: { GuestKycNeeded: 'guest-kyc-needed', PayerKycNeeded: 'payer-kyc-needed' },
    useDetermineBankRequestType: () => ({ requestType: 'user-bank-request' }),
}))

const bankMethod = { id: 'bank', title: 'Bank', description: 'EUR, USD, MXN, ARS & more', icons: [], soon: false }
const walletMethod = { id: 'exchange-or-wallet', title: 'Exchange or Wallet', description: '', icons: [], soon: false }
jest.mock('@/hooks/useGeoFilteredPaymentOptions', () => ({
    useGeoFilteredPaymentOptions: () => ({ filteredMethods: [bankMethod, walletMethod], isLoading: false }),
}))

const mockDrawer = jest.fn()
jest.mock('../PayByBankTransferDrawer', () => ({
    PayByBankTransferDrawer: (props: { bankPayable: boolean }) => {
        mockDrawer(props)
        return props.bankPayable ? <div>Pay by bank transfer</div> : null
    },
}))

import { RequestPotActionList } from '../RequestPotActionList'

const signedIn = { user: { user: { userId: 'me' } }, isFetchingUser: false }
const signedOut = { user: null, isFetchingUser: false }

function renderList(props: Partial<React.ComponentProps<typeof RequestPotActionList>> = {}) {
    return render(
        <IntlWrapper>
            <RequestPotActionList
                isAmountEntered
                usdAmount="20"
                remainingUsd={100}
                requestId="req-1"
                bankPayable
                onPayWithPeanut={jest.fn()}
                onPayWithExternalWallet={jest.fn()}
                {...props}
            />
        </IntlWrapper>
    )
}

/** the visible row labels below the Peanut CTA, in document order */
const rowOrder = () =>
    screen.getAllByText(/^(Bank|Exchange or Wallet|Pay by bank transfer)$/).map((node) => node.textContent)

beforeEach(() => {
    jest.clearAllMocks()
    mockAuth = signedIn
})

describe('RequestPotActionList', () => {
    it('leads with the requester bank details for a signed-out payer, and hides the generic bank method', () => {
        mockAuth = signedOut
        renderList()

        expect(rowOrder()).toEqual(['Pay by bank transfer', 'Exchange or Wallet'])
    })

    it('keeps the generic bank method for a signed-out payer when the requester shares no details', () => {
        mockAuth = signedOut
        renderList({ bankPayable: false })

        expect(rowOrder()).toEqual(['Bank', 'Exchange or Wallet'])
    })

    it('keeps both bank rows for a signed-in payer, with the requester details last', () => {
        renderList()

        expect(rowOrder()).toEqual(['Bank', 'Exchange or Wallet', 'Pay by bank transfer'])
    })

    // A signed-in payer must not see the rows jump once the session resolves.
    it('does not reorder while the session is still loading', () => {
        mockAuth = { user: null, isFetchingUser: true }
        renderList()

        expect(rowOrder()).toEqual(['Bank', 'Exchange or Wallet', 'Pay by bank transfer'])
    })

    it('hands the drawer the payer amount and what the request still needs', () => {
        renderList()

        expect(mockDrawer).toHaveBeenCalledWith(expect.objectContaining({ usdAmount: '20', remainingUsd: 100 }))
    })

    // A non-dollar token amount must not be shown to a bank payer as dollars.
    it('hands the drawer no amount for a request in a non-dollar token', () => {
        renderList({ requestTokenSymbol: 'ETH' })

        expect(mockDrawer).toHaveBeenCalledWith(
            expect.objectContaining({ usdAmount: undefined, remainingUsd: undefined })
        )
    })
})

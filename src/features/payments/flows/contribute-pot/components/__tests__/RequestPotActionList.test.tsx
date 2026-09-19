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
    PayByBankTransferDrawer: (props: { bankPayable: boolean; rail?: { payerAmount: { currency: string } } }) => {
        mockDrawer(props)
        if (!props.bankPayable) return null
        return <div>{props.rail ? `Pay in ${props.rail.payerAmount.currency}` : 'Pay by bank transfer'}</div>
    },
}))

let mockPayAmounts: unknown
const mockUsePayAmounts = jest.fn()
jest.mock('@/components/Request/Pay/useRequestPayAmounts', () => ({
    useRequestPayAmounts: (uuid: string | undefined) => {
        mockUsePayAmounts(uuid)
        return { payAmounts: uuid ? mockPayAmounts : undefined, isLoading: false }
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
    screen
        .getAllByText(/^(Bank|Exchange or Wallet|Pay by bank transfer|Pay in [A-Z]{3})$/)
        .map((node) => node.textContent)

const usdRail = { kind: 'peanut_balance', payerAmount: { amount: '108.00', currency: 'USD', isEstimate: false } }
const bankRail = (currency: string, railId: string, isEstimate: boolean) => ({
    kind: 'bank',
    railId,
    reference: 'a1b2c3d4',
    payerAmount: { amount: '100.00', currency, isEstimate },
})

beforeEach(() => {
    jest.clearAllMocks()
    mockAuth = signedIn
    mockPayAmounts = undefined
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

    describe('per-rail amounts', () => {
        it('shows one bank row per currency the requester can receive, each with its rail', () => {
            mockPayAmounts = {
                requestCurrency: 'EUR',
                requestAmount: '100.00',
                rails: [usdRail, bankRail('EUR', 'bridge.sepa_eu', false), bankRail('USD', 'bridge.ach_us', true)],
            }
            renderList({ requestCurrency: 'EUR' })

            expect(rowOrder()).toEqual(['Bank', 'Exchange or Wallet', 'Pay in EUR', 'Pay in USD'])
            expect(mockDrawer).toHaveBeenCalledWith(
                expect.objectContaining({ rail: expect.objectContaining({ railId: 'bridge.sepa_eu' }) })
            )
        })

        // The bank amounts were computed from the API's own remainder, so that
        // is the number the payer amount is compared with. A smaller remainder
        // than the screen's knows of a payment the screen has not loaded.
        it('hands the drawer the API remainder in dollars, when it is not above the screen remainder', () => {
            mockPayAmounts = {
                requestCurrency: 'EUR',
                requestAmount: '100.00',
                remainingAmount: '100.00',
                rails: [usdRail, bankRail('EUR', 'bridge.sepa_eu', false)],
            }
            renderList({ requestCurrency: 'EUR', remainingUsd: 120 })

            expect(mockDrawer).toHaveBeenCalledWith(
                expect.objectContaining({ remainingUsd: 108, serverCountsAllPayments: true })
            )
        })

        /**
         * Somebody paid $51 from a wallet. An API remainder that counts bank
         * deposits only still says $108, and its bank figure is a copyable
         * "EUR 100.00 · Exact" for a request with $57 open.
         */
        it('drops the API figures when its remainder missed a wallet contribution', () => {
            mockPayAmounts = {
                requestCurrency: 'EUR',
                requestAmount: '100.00',
                remainingAmount: '100.00',
                rails: [usdRail, bankRail('EUR', 'bridge.sepa_eu', false)],
            }
            renderList({ requestCurrency: 'EUR', remainingUsd: 57 })

            expect(mockDrawer).toHaveBeenCalledWith(
                expect.objectContaining({ remainingUsd: 57, serverCountsAllPayments: false })
            )
        })

        it('states what is left on a part-paid non-dollar request', () => {
            mockPayAmounts = {
                requestCurrency: 'EUR',
                requestAmount: '100.00',
                remainingAmount: '40.00',
                rails: [usdRail],
            }
            renderList({ bankPayable: false, requestCurrency: 'EUR', remainingUsd: 108 })

            expect(screen.getByText(/asks for 100\.00 EUR, and 40\.00 EUR is left to pay\./)).toBeInTheDocument()
        })

        it('states no remainder where the API missed a payment', () => {
            mockPayAmounts = {
                requestCurrency: 'EUR',
                requestAmount: '100.00',
                remainingAmount: '90.00',
                rails: [usdRail],
            }
            renderList({ bankPayable: false, requestCurrency: 'EUR', remainingUsd: 57 })

            expect(screen.getByText(/This request asks for 100\.00 EUR\./)).toBeInTheDocument()
            expect(screen.queryByText(/is left to pay/)).not.toBeInTheDocument()
        })

        // A euro request is paid in dollars on the Peanut and crypto rails.
        it('tells the payer what a non-dollar request asks for', () => {
            mockPayAmounts = { requestCurrency: 'EUR', requestAmount: '100.00', rails: [usdRail] }
            renderList({ bankPayable: false, requestCurrency: 'EUR' })

            expect(screen.getByText(/This request asks for 100\.00 EUR\./)).toBeInTheDocument()
        })

        it('says nothing about the currency of a dollar request', () => {
            mockPayAmounts = { requestCurrency: 'USD', requestAmount: '100.00', rails: [usdRail] }
            renderList()

            expect(screen.queryByText(/This request asks for/)).not.toBeInTheDocument()
        })

        // An API that predates the route: one generic row, and the backend picks the account.
        it('keeps the one generic bank row when the API returns no rails', () => {
            renderList()

            expect(rowOrder()).toEqual(['Bank', 'Exchange or Wallet', 'Pay by bank transfer'])
            expect(mockDrawer.mock.calls[0][0].rail).toBeUndefined()
        })

        it('does not read pay amounts for a dollar request that shares no bank details', () => {
            renderList({ bankPayable: false })

            expect(mockUsePayAmounts).toHaveBeenCalledWith(undefined)
        })

        it('never lists bank rails on a request that shares no bank details', () => {
            mockPayAmounts = {
                requestCurrency: 'EUR',
                requestAmount: '100.00',
                rails: [usdRail, bankRail('EUR', 'bridge.sepa_eu', false)],
            }
            renderList({ bankPayable: false, requestCurrency: 'EUR' })

            expect(rowOrder()).toEqual(['Bank', 'Exchange or Wallet'])
        })
    })
})

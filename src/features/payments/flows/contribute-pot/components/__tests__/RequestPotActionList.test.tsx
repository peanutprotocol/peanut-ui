/**
 * RequestPotActionList — which bank row a payer sees, and in what order.
 *
 * The generic "Bank" method funds a Peanut balance first, so a signed-out payer
 * who taps it lands in signup. When the requester shares bank details, a
 * signed-out payer can pay with no account: that row leads and the generic one
 * is hidden.
 */
import { fireEvent, render, screen } from '@testing-library/react'
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

const bankMethod = {
    id: 'bank',
    title: 'Bank transfer',
    description: 'EUR, USD, MXN, ARS and more',
    icons: [],
    soon: false,
}
const walletMethod = { id: 'exchange-or-wallet', title: 'Crypto', description: '', icons: [], soon: false }
jest.mock('@/hooks/useGeoFilteredPaymentOptions', () => ({
    useGeoFilteredPaymentOptions: () => ({ filteredMethods: [bankMethod, walletMethod], isLoading: false }),
}))

const mockDrawer = jest.fn()
jest.mock('../PayByBankTransferDrawer', () => ({
    PayByBankTransferDrawer: (props: {
        bankPayable: boolean
        rail?: { payerAmount: { currency: string } }
        onUnavailable?: () => void
    }) => {
        mockDrawer(props)
        if (!props.bankPayable) return null
        return (
            <div onClick={props.onUnavailable}>
                {props.rail ? `Pay in ${props.rail.payerAmount.currency}` : 'Pay by bank transfer'}
            </div>
        )
    },
}))

const mockChooser = jest.fn()
jest.mock('../BankTransferChooserDrawer', () => ({
    BankTransferChooserDrawer: (props: {
        rails: Array<{ railId?: string; payerAmount: { currency: string } }>
        onUnavailable: (rail: { railId?: string; payerAmount: { currency: string } }) => void
    }) => {
        mockChooser(props)
        return (
            <div>
                <span>Pay by bank transfer</span>
                {props.rails.map((rail) => (
                    <button key={rail.railId} onClick={() => props.onUnavailable(rail)}>
                        {`Rail ${rail.payerAmount.currency}`}
                    </button>
                ))}
            </div>
        )
    },
}))

let mockPayAmounts: unknown
let mockPayAmountsLoading = false
const mockUsePayAmounts = jest.fn()
jest.mock('@/components/Request/Pay/useRequestPayAmounts', () => ({
    useRequestPayAmounts: (uuid: string | undefined) => {
        mockUsePayAmounts(uuid)
        return { payAmounts: uuid ? mockPayAmounts : undefined, isLoading: mockPayAmountsLoading }
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
    screen.getAllByText(/^(Bank transfer|Crypto|Pay by bank transfer|Pay in [A-Z]{3})$/).map((node) => node.textContent)

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
    mockPayAmountsLoading = false
})

describe('RequestPotActionList', () => {
    it('leads with the requester bank details for a signed-out payer, and hides the generic bank method', () => {
        mockAuth = signedOut
        renderList()

        expect(rowOrder()).toEqual(['Pay by bank transfer', 'Crypto'])
    })

    it('keeps the generic bank method for a signed-out payer when the requester shares no details', () => {
        mockAuth = signedOut
        renderList({ bankPayable: false })

        expect(rowOrder()).toEqual(['Bank transfer', 'Crypto'])
    })

    it('keeps both bank rows for a signed-in payer, with the requester details last', () => {
        renderList()

        expect(rowOrder()).toEqual(['Bank transfer', 'Crypto', 'Pay by bank transfer'])
    })

    // A signed-in payer must not see the rows jump once the session resolves.
    it('does not reorder while the session is still loading', () => {
        mockAuth = { user: null, isFetchingUser: true }
        renderList()

        expect(rowOrder()).toEqual(['Bank transfer', 'Crypto', 'Pay by bank transfer'])
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
        it('shows one bank-transfer row and hands its chooser every eligible rail', () => {
            mockPayAmounts = {
                requestCurrency: 'EUR',
                requestAmount: '100.00',
                rails: [usdRail, bankRail('EUR', 'bridge.sepa_eu', false), bankRail('USD', 'bridge.ach_us', true)],
            }
            renderList({ requestCurrency: 'EUR' })

            expect(rowOrder()).toEqual(['Bank transfer', 'Crypto', 'Pay by bank transfer'])
            expect(mockChooser).toHaveBeenCalledWith(
                expect.objectContaining({
                    requestAmount: '100.00 EUR',
                    rails: [
                        expect.objectContaining({ railId: 'bridge.sepa_eu' }),
                        expect.objectContaining({ railId: 'bridge.ach_us' }),
                    ],
                })
            )
        })

        it('does not describe an open request as requesting zero', () => {
            mockPayAmounts = {
                requestCurrency: 'USD',
                requestAmount: '0',
                remainingAmount: null,
                rails: [bankRail('USD', 'bridge.ach_us', false)],
            }
            renderList()

            expect(mockChooser).toHaveBeenCalledWith(expect.objectContaining({ requestAmount: undefined }))
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

            expect(mockChooser).toHaveBeenCalledWith(
                expect.objectContaining({
                    bankRowProps: expect.objectContaining({ remainingUsd: 108, serverCountsAllPayments: true }),
                })
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

            expect(mockChooser).toHaveBeenCalledWith(
                expect.objectContaining({
                    bankRowProps: expect.objectContaining({ remainingUsd: 57, serverCountsAllPayments: false }),
                })
            )
        })

        /*
         * No Peanut rail in the answer is NO figure from the API, not a figure
         * that disagrees. Read as a disagreement it downgraded an exact
         * same-currency amount to an estimate, and could reduce the note to
         * dollars-only.
         */
        it('keeps the API figures when the answer carries no dollar rail at all', () => {
            mockPayAmounts = {
                requestCurrency: 'EUR',
                requestAmount: '100.00',
                remainingAmount: '40.00',
                rails: [bankRail('EUR', 'bridge.sepa_eu', false)],
            }
            renderList({ requestCurrency: 'EUR', remainingUsd: 57 })

            expect(mockChooser).toHaveBeenCalledWith(
                expect.objectContaining({
                    bankRowProps: expect.objectContaining({ remainingUsd: 57, serverCountsAllPayments: true }),
                })
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

        // the currency the request asks in is the one a bank payer settles exactly
        it('leads the bank rows with the currency the request asks in', () => {
            mockPayAmounts = {
                requestCurrency: 'EUR',
                requestAmount: '50.00',
                rails: [
                    usdRail,
                    bankRail('USD', 'bridge.ach_us', false),
                    bankRail('GBP', 'bridge.faster_payments_gb', true),
                    bankRail('EUR', 'bridge.sepa_eu', false),
                ],
            }
            renderList({ requestCurrency: 'EUR', remainingUsd: 108 })

            expect(mockChooser.mock.calls.at(-1)?.[0].rails.map((rail: any) => rail.payerAmount.currency)).toEqual([
                'EUR',
                'USD',
                'GBP',
            ])
        })

        it('stops offering a rail whose details turned out to be unavailable', () => {
            mockPayAmounts = {
                requestCurrency: 'EUR',
                requestAmount: '50.00',
                rails: [usdRail, bankRail('EUR', 'bridge.sepa_eu', false), bankRail('USD', 'bridge.ach_us', false)],
            }
            renderList({ requestCurrency: 'EUR', remainingUsd: 108 })

            fireEvent.click(screen.getByText('Rail USD'))
            expect(mockChooser.mock.calls.at(-1)?.[0].rails.map((rail: any) => rail.payerAmount.currency)).toEqual([
                'EUR',
            ])
        })

        /**
         * The generic row used to render first and be swapped for the per-rail
         * rows, whose keys differ: a drawer the payer had opened lost its state.
         */
        it('holds a placeholder, and no bank row, until the rails are known', () => {
            mockPayAmountsLoading = true
            renderList()

            expect(screen.getByTestId('bank-rows-loading')).toBeInTheDocument()
            expect(mockDrawer).not.toHaveBeenCalled()
        })

        it('holds no placeholder on a request that shares no bank details', () => {
            mockPayAmountsLoading = true
            renderList({ bankPayable: false, requestCurrency: 'EUR' })

            expect(screen.queryByTestId('bank-rows-loading')).not.toBeInTheDocument()
        })

        /**
         * A request that is still open with nothing left to pay: the API lists no
         * bank rail and its bank details answer 404. The generic row used to show
         * and open onto "not available".
         */
        it('offers no way to pay a request that is covered: the notice is the whole screen', () => {
            mockPayAmounts = { requestCurrency: 'USD', requestAmount: '100.00', remainingAmount: '0', rails: [usdRail] }
            renderList()

            // The request still reads OPEN — only a matched bank deposit closes
            // one — so the CTA and every method used to stay live above the
            // notice, prefilled with the full amount.
            expect(screen.getByTestId('request-already-covered')).toBeInTheDocument()
            expect(screen.queryByText('Pay with Peanut')).not.toBeInTheDocument()
            expect(screen.queryAllByText(/^(Bank transfer|Crypto)$/)).toHaveLength(0)
            expect(mockDrawer).not.toHaveBeenCalled()
        })

        it("says so from the screen's own count, where no pay-amounts read happens at all", () => {
            // A request paid in full from wallets, with no bank details shared:
            // nothing fetches `/pay-amounts`, and the screen still must not
            // invite a second payment.
            renderList({ bankPayable: false, remainingUsd: 0 })

            expect(screen.getByTestId('request-already-covered')).toBeInTheDocument()
            expect(screen.queryByText('Pay with Peanut')).not.toBeInTheDocument()
        })

        it('does not call an open-amount request covered', () => {
            mockPayAmounts = { requestCurrency: 'USD', requestAmount: null, remainingAmount: null, rails: [usdRail] }
            renderList()

            expect(screen.queryByTestId('request-already-covered')).not.toBeInTheDocument()
        })

        // An API that predates the route: one generic row, and the backend picks the account.
        it('keeps the one generic bank row when the API returns no rails', () => {
            renderList()

            expect(rowOrder()).toEqual(['Bank transfer', 'Crypto', 'Pay by bank transfer'])
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

            expect(rowOrder()).toEqual(['Bank transfer', 'Crypto'])
        })
    })
})

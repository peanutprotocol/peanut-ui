/**
 * The Send button on a request pot must not be offered before the LIVE wallet
 * balance has resolved. The view only pays on a live, sufficient balance, so a
 * Send tapped earlier did nothing: no charge, no error, and nothing replayed
 * once the balance arrived.
 *
 * The real `useWallet` runs here, fed by mocked inputs (smart-account query,
 * Rain overview, kernel address, last-known cache). The display shows a cached
 * total while the live terms are pending, so "nothing on screen is loading" is
 * not the same as "the balance can be spent".
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ visible, title }: { visible: boolean; title: string }) =>
        visible ? <div data-testid="action-modal">{title}</div> : null,
}))
jest.mock('@/hooks/useGuestStoreHandoff', () => ({
    useGuestStoreHandoff: () => ({ interceptGuestCta: () => false, storeHandoffModal: null }),
}))

const WALLET_ADDRESS = '0x1111111111111111111111111111111111111111'
const USER_ID = 'payer'
const signedIn = {
    user: { user: { userId: USER_ID }, accounts: [{ type: 'peanut-wallet', identifier: WALLET_ADDRESS }] },
    isFetchingUser: false,
}
let mockAuth: { user: unknown; isFetchingUser: boolean }
jest.mock('@/context/authContext', () => ({ useAuth: () => mockAuth }))

// the live inputs of useWallet
let mockSmart: { data: bigint | undefined; isLoading: boolean }
let mockRainOverview: { balance: { spendingPower: number } | null } | undefined
jest.mock('@/hooks/wallet/useBalance', () => ({
    useBalance: (address: string | undefined) =>
        address ? { ...mockSmart, refetch: jest.fn() } : { data: undefined, isLoading: false, refetch: jest.fn() },
}))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: mockRainOverview, isLoading: false }),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('@tanstack/react-query', () => ({
    ...jest.requireActual('@tanstack/react-query'),
    useIsFetching: () => 0,
}))
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ address: WALLET_ADDRESS, isKernelClientReady: true, handleSendUserOpEncoded: jest.fn() }),
}))
jest.mock('@/hooks/wallet/useSendMoney', () => ({ useSendMoney: () => ({ mutateAsync: jest.fn() }) }))
jest.mock('@/hooks/wallet/useSpendBundle', () => ({ useSpendBundle: () => ({ spend: jest.fn() }) }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))

jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ canDo: () => true }) }))
jest.mock('@/hooks/useDetermineBankRequestType', () => ({
    BankRequestType: { GuestKycNeeded: 'guest-kyc-needed', PayerKycNeeded: 'payer-kyc-needed' },
    useDetermineBankRequestType: () => ({ requestType: 'user-bank-request' }),
}))
jest.mock('@/hooks/useGeoFilteredPaymentOptions', () => ({
    useGeoFilteredPaymentOptions: () => ({
        filteredMethods: [{ id: 'exchange-or-wallet', title: 'Crypto', description: '', icons: [], soon: false }],
        isLoading: false,
    }),
}))
jest.mock('@/components/Request/Pay/useRequestPayAmounts', () => ({
    useRequestPayAmounts: () => ({ payAmounts: undefined, isLoading: false }),
}))

import { RequestPotActionList } from '../RequestPotActionList'
import { useWallet } from '@/hooks/wallet/useWallet'
import { writeLastKnownSpendable } from '@/hooks/wallet/lastKnownSpendable'

const usd = (amount: number) => BigInt(Math.round(amount * 1e6))
const onPayWithPeanut = jest.fn()
const onPayWithExternalWallet = jest.fn()

/** what the same hook puts on screen next to the button */
function DisplayedBalance() {
    const { formattedSpendableBalance, isFetchingSpendableBalance } = useWallet()
    return (
        <output data-testid="displayed-balance">
            {isFetchingSpendableBalance ? 'loading' : formattedSpendableBalance}
        </output>
    )
}

const ui = () => (
    <IntlWrapper>
        <DisplayedBalance />
        <RequestPotActionList
            isAmountEntered
            usdAmount="0.50"
            remainingUsd={10}
            onPayWithPeanut={onPayWithPeanut}
            onPayWithExternalWallet={onPayWithExternalWallet}
        />
    </IntlWrapper>
)

const sendButton = () => screen.getByRole('button', { name: /^(send with|add funds to|join)/i })
const displayed = () => screen.getByTestId('displayed-balance')

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    mockAuth = signedIn
    mockSmart = { data: undefined, isLoading: true }
    mockRainOverview = undefined
})

describe('RequestPotActionList — Send before the live balance resolves', () => {
    it.each([
        ['a cached $3.90', 3.9, /^3\.9/],
        ['a cached $0', 0, /^0/],
    ])('offers no actionable Send while Rain is pending and the screen shows %s', async (_, cached, shown) => {
        writeLastKnownSpendable(USER_ID, usd(cached))
        mockSmart = { data: 0n, isLoading: false }
        render(ui())

        // the display is settled on the cached number: it does not read as loading
        await waitFor(() => expect(displayed()).toHaveTextContent(shown))
        expect(sendButton()).toBeDisabled()
        fireEvent.click(sendButton())
        expect(onPayWithPeanut).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('offers no actionable Send while the wallet balance is pending behind a cached total', async () => {
        writeLastKnownSpendable(USER_ID, usd(3.9))
        mockRainOverview = { balance: { spendingPower: 390 } }
        render(ui())

        await waitFor(() => expect(sendButton()).toBeInTheDocument())
        expect(sendButton()).toBeDisabled()
        fireEvent.click(sendButton())
        expect(onPayWithPeanut).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('enables Send once both live terms resolve, counting collateral, and pays through the callback once', async () => {
        writeLastKnownSpendable(USER_ID, usd(3.9))
        const { rerender } = render(ui())
        await waitFor(() => expect(displayed()).toHaveTextContent(/^3\.9/))
        expect(sendButton()).toBeDisabled()

        // the wallet holds nothing: the $3.90 is all card collateral
        mockSmart = { data: 0n, isLoading: false }
        mockRainOverview = { balance: { spendingPower: 390 } }
        rerender(ui())

        expect(sendButton()).toBeEnabled()
        expect(sendButton()).toHaveTextContent(/^send with/i)
        fireEvent.click(sendButton())
        expect(onPayWithPeanut).toHaveBeenCalledTimes(1)
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('sends a resolved insufficient balance to Add funds, not to the pay callback', () => {
        mockSmart = { data: 0n, isLoading: false }
        mockRainOverview = { balance: { spendingPower: 10 } }
        render(ui())

        expect(sendButton()).toBeEnabled()
        expect(sendButton()).toHaveTextContent(/^add funds to/i)
        fireEvent.click(sendButton())
        expect(mockPush).toHaveBeenCalledWith('/add-money')
        expect(onPayWithPeanut).not.toHaveBeenCalled()
    })

    it('keeps the signed-out Join CTA live: there is no balance to wait on', () => {
        mockAuth = { user: null, isFetchingUser: false }
        render(ui())

        expect(sendButton()).toBeEnabled()
        expect(sendButton()).toHaveTextContent(/^join/i)
        fireEvent.click(sendButton())
        expect(mockPush).toHaveBeenCalledWith('/setup')
        expect(onPayWithPeanut).not.toHaveBeenCalled()
    })

    it('goes straight to the external flow while the balance is pending, with no Peanut modal or payment', async () => {
        writeLastKnownSpendable(USER_ID, usd(3.9))
        render(ui())
        await waitFor(() => expect(displayed()).toHaveTextContent(/^3\.9/))

        fireEvent.click(screen.getByText('Crypto'))

        expect(screen.queryByTestId('action-modal')).not.toBeInTheDocument()
        expect(onPayWithExternalWallet).toHaveBeenCalledTimes(1)
        expect(onPayWithPeanut).not.toHaveBeenCalled()
    })

    it('still offers the Peanut balance modal first once the live balance resolves sufficient', () => {
        mockSmart = { data: 0n, isLoading: false }
        mockRainOverview = { balance: { spendingPower: 390 } }
        render(ui())

        fireEvent.click(screen.getByText('Crypto'))

        expect(screen.getByTestId('action-modal')).toBeInTheDocument()
        expect(onPayWithExternalWallet).not.toHaveBeenCalled()
    })
})

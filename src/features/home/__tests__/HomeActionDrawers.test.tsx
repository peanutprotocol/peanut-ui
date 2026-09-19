import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { HomeActionDrawers } from '../components/HomeActionDrawers'
import { resetBottomNavVisibilityForTests, useBottomNavHidden } from '@/utils/bottom-nav-visibility'

const NavProbe = () => <span data-testid="nav-hidden">{String(useBottomNavHidden())}</span>

// F-28: the real nuqs pipeline runs (parser, enum validation, url writes) via
// the official testing adapter — the old suite mocked all of nuqs, so the
// ?drawer= URL contract was asserted nowhere.

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}))

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))

jest.mock('@/hooks/useAppHaptic', () => ({
    useAppHaptic: () => ({ triggerHaptic: jest.fn() }),
}))

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))

// Get-paid is dark until Bridge grants the Virtual Accounts SKU, so the bank
// row has two truths and both have to hold.
let depositAccountsEnabled = true
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => depositAccountsEnabled,
}))

beforeAll(() => {
    window.matchMedia =
        window.matchMedia ||
        ((query: string) =>
            ({
                matches: false,
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {},
                addListener: () => {},
                removeListener: () => {},
                dispatchEvent: () => false,
                onchange: null,
            }) as MediaQueryList)
})

beforeEach(() => {
    jest.clearAllMocks()
    resetBottomNavVisibilityForTests()
    depositAccountsEnabled = true
})

const renderWithUrl = (search: string, onUrlUpdate?: (e: UrlUpdateEvent) => void) =>
    render(<HomeActionDrawers />, {
        wrapper: withNuqsTestingAdapter({ searchParams: search, onUrlUpdate }),
    })

describe('HomeActionDrawers', () => {
    it('renders nothing when no drawer param is set', () => {
        renderWithUrl('')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('URL contract: the key is `drawer` and values outside the enum read as closed', () => {
        renderWithUrl('?drawer=nonsense')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('opens the send drawer from ?drawer=send and routes on click after clearing the param', async () => {
        const urlUpdates: UrlUpdateEvent[] = []
        renderWithUrl('?drawer=send', (e) => urlUpdates.push(e))

        expect(screen.getByText('sendToFriends')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('home-drawer-send-withdraw'))
        // push must wait for the queued url reset (coderabbit #2780)
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/withdraw'))
        // the drawer param was cleared from the URL before routing
        expect(urlUpdates.at(-1)?.searchParams.get('drawer')).toBeNull()
    })

    it('opens the add drawer with bank and crypto options only', async () => {
        renderWithUrl('?drawer=add')

        // Both bank rows lead to the country selector — the single entry to
        // every bank route, standing account and one-off top-up alike.
        fireEvent.click(screen.getByTestId('home-drawer-add-bank'))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank'))

        fireEvent.click(screen.getByTestId('home-drawer-add-crypto'))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money/crypto'))

        // withdraw is reachable via the SEND drawer only (product ruling)
        expect(screen.queryByTestId('home-drawer-add-withdraw')).not.toBeInTheDocument()
    })

    it('lists bank before crypto (2026-09-18 decision: bank leads the add drawer)', () => {
        renderWithUrl('?drawer=add')

        const bank = screen.getByTestId('home-drawer-add-bank')
        const crypto = screen.getByTestId('home-drawer-add-crypto')
        // Node.DOCUMENT_POSITION_FOLLOWING: bank comes before crypto in the DOM
        expect(bank.compareDocumentPosition(crypto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    /*
     * The middle link of the returnTo chain (chip P23): bare /add-money
     * redirects to /home?drawer=add&returnTo=X, and choosing an option must
     * carry X onto the destination while CLEARING it from home's own history
     * entry — a stale origin left behind would be forwarded into an
     * unrelated flow on a later Add open.
     */
    it('carries returnTo onto the crypto destination and clears it from home', async () => {
        const urlUpdates: UrlUpdateEvent[] = []
        const origin = '/profile/exchange-rate?from=USD&to=EUR'
        renderWithUrl(`?drawer=add&returnTo=${encodeURIComponent(origin)}`, (e) => urlUpdates.push(e))

        fireEvent.click(screen.getByTestId('home-drawer-add-crypto'))
        await waitFor(() =>
            expect(mockPush).toHaveBeenCalledWith(`/add-money/crypto?returnTo=${encodeURIComponent(origin)}`)
        )
        const last = urlUpdates[urlUpdates.length - 1]
        expect(last.searchParams.get('drawer')).toBeNull()
        expect(last.searchParams.get('returnTo')).toBeNull()
    })

    it('sends the bank row to the country list while get-paid is off', async () => {
        depositAccountsEnabled = false
        renderWithUrl('?drawer=add')

        fireEvent.click(screen.getByTestId('home-drawer-add-bank'))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank'))
    })

    /*
     * Both bank rows land on the country list, so the country click is the one
     * place the bank arm of deposit_method_selected is reported. A capture
     * here too counted the same user twice as soon as the flag went on.
     */
    it.each([true, false])('leaves the bank funnel event to the country click (get-paid on: %s)', async (enabled) => {
        depositAccountsEnabled = enabled
        renderWithUrl('?drawer=add')

        fireEvent.click(screen.getByTestId('home-drawer-add-bank'))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank'))
        expect(mockCapture).not.toHaveBeenCalled()
    })

    it('opens the request drawer with both share actions and routes each on click', async () => {
        const urlUpdates: UrlUpdateEvent[] = []
        renderWithUrl('?drawer=request', (e) => urlUpdates.push(e))

        // both ways to be paid are offered on one screen
        expect(screen.getByText('shareRequestLink')).toBeInTheDocument()
        expect(screen.getByText('shareBankDetails')).toBeInTheDocument()
        // A description is a sentence. Cut to one line it lost half of itself in
        // pt-BR and es-419, so it wraps.
        expect(screen.getByText('shareBankDetailsDescription')).toHaveClass('whitespace-normal')
        expect(screen.getByText('shareBankDetailsDescription')).not.toHaveClass('truncate')

        fireEvent.click(screen.getByTestId('home-drawer-request-share-link'))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/request'))
        // the drawer param is cleared before routing, so browser-back lands on a closed home
        expect(urlUpdates.at(-1)?.searchParams.get('drawer')).toBeNull()

        fireEvent.click(screen.getByTestId('home-drawer-request-share-bank'))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank'))
    })

    it('drops the bank-details row from the request drawer while get-paid is off', () => {
        depositAccountsEnabled = false
        renderWithUrl('?drawer=request')

        expect(screen.getByTestId('home-drawer-request-share-link')).toBeInTheDocument()
        expect(screen.queryByTestId('home-drawer-request-share-bank')).not.toBeInTheDocument()
    })

    it('carries a query-bearing returnTo onto the bank destination', async () => {
        // The origin holds its own query string, so the value has to survive
        // encoding whole — an unencoded `&to=EUR` would arrive as a separate
        // param and the back button would land on half a URL.
        const origin = '/profile/exchange-rate?from=USD&to=EUR'
        renderWithUrl(`?drawer=add&returnTo=${encodeURIComponent(origin)}`)

        fireEvent.click(screen.getByTestId('home-drawer-add-bank'))
        await waitFor(() =>
            expect(mockPush).toHaveBeenCalledWith(`/add-money?method=bank&returnTo=${encodeURIComponent(origin)}`)
        )
    })

    it('hides the bottom nav while open and releases the hold once closed', async () => {
        render(
            <>
                <NavProbe />
                <HomeActionDrawers />
            </>,
            { wrapper: withNuqsTestingAdapter({ searchParams: '?drawer=send' }) }
        )

        expect(screen.getByTestId('nav-hidden')).toHaveTextContent('true')

        fireEvent.click(screen.getByTestId('home-drawer-send-withdraw'))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/withdraw'))
        await waitFor(() => expect(screen.getByTestId('nav-hidden')).toHaveTextContent('false'))
    })

    it('leaves the bottom nav alone when no drawer is open', () => {
        render(
            <>
                <NavProbe />
                <HomeActionDrawers />
            </>,
            { wrapper: withNuqsTestingAdapter({ searchParams: '' }) }
        )
        expect(screen.getByTestId('nav-hidden')).toHaveTextContent('false')
    })
})

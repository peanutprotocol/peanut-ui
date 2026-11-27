import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { resolveAddMoneyMethods } from '@/features/add-money/addMoneyMethods'
import { saveLastDepositMethod } from '@/features/add-money/lastUsedAddMethod'
import { isCapacitor } from '@/utils/capacitor'
import { HomeActionDrawers } from '../components/HomeActionDrawers'
import { resetBottomNavVisibilityForTests, useBottomNavHidden } from '@/utils/bottom-nav-visibility'

const NavProbe = () => <span data-testid="nav-hidden">{String(useBottomNavHidden())}</span>

// F-28: the real nuqs pipeline runs (parser, enum validation, url writes) via
// the official testing adapter — the old suite mocked all of nuqs, so the
// ?drawer= URL contract was asserted nowhere.

const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))

jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: jest.fn(() => false),
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
    jest.mocked(isCapacitor).mockReturnValue(false)
    localStorage.clear()
})

const returning = resolveAddMoneyMethods({
    cryptoReady: true,
    standingEnabled: true,
    brazilPaused: false,
    residenceIso2s: ['PT'],
    activeAccounts: ['EUR'],
    readyTopUps: [],
})
const firstTime = resolveAddMoneyMethods({
    cryptoReady: true,
    standingEnabled: true,
    brazilPaused: false,
    residenceIso2s: ['PT'],
    activeAccounts: [],
    readyTopUps: [],
})
const renderWithUrl = (search: string, onUrlUpdate?: (e: UrlUpdateEvent) => void, addMoney = returning) =>
    render(<HomeActionDrawers addMoney={{ ...addMoney, isLoading: false }} />, {
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

    // Kush, 27 Nov: "Bank accounts" and "More ways to add money" are one Bank transfer row, as on the picker
    it('lists the picker rows, with one Bank transfer row that opens the bank hub', async () => {
        renderWithUrl('?drawer=add')

        const rows = screen.getAllByTestId(/^home-drawer-add-/)
        expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
            'home-drawer-add-bank',
            'home-drawer-add-crypto',
        ])
        expect(rows[0]).toHaveTextContent('bankTransfer')

        fireEvent.click(rows[0])
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank'))
        expect(mockCapture).not.toHaveBeenCalled()
    })

    describe('the last used method', () => {
        const ids = () => screen.getAllByTestId(/^home-drawer-add-/).map((row) => row.getAttribute('data-testid'))

        it('shows no Last used section before any deposit completed', () => {
            renderWithUrl('?drawer=add')
            expect(screen.queryByText('lastUsed')).not.toBeInTheDocument()
            expect(screen.queryByText('otherWays')).not.toBeInTheDocument()
        })

        // Kush, 27 Nov: "last used" is the last completed deposit, never a tap
        it('does not remember a tap alone', async () => {
            const first = renderWithUrl('?drawer=add')
            fireEvent.click(screen.getByTestId('home-drawer-add-crypto'))
            await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money/crypto'))
            first.unmount()

            renderWithUrl('?drawer=add')
            expect(screen.queryByText('lastUsed')).not.toBeInTheDocument()
            expect(ids()).toEqual(['home-drawer-add-bank', 'home-drawer-add-crypto'])
        })

        it('leads with the method of the last completed deposit under Last used', () => {
            saveLastDepositMethod('crypto')
            renderWithUrl('?drawer=add')
            expect(screen.getByRole('heading', { name: 'lastUsed' })).toBeInTheDocument()
            expect(screen.getByRole('heading', { name: 'otherWays' })).toBeInTheDocument()
            expect(ids()).toEqual(['home-drawer-add-crypto', 'home-drawer-add-bank'])
        })

        it('ignores a stored method this user no longer has, and keeps every row', () => {
            localStorage.setItem('peanut-last-add-method', JSON.stringify('ars'))
            renderWithUrl('?drawer=add')
            expect(screen.queryByText('lastUsed')).not.toBeInTheDocument()
            expect(ids()).toEqual(['home-drawer-add-bank', 'home-drawer-add-crypto'])
        })
    })

    // Which Pix deposit routes offer the row: useAddMoneyReadiness.test.ts
    it('leads with Pix on a route on Avenia and opens the Pix deposit directly (Aleks, 2026-11-12 and 2026-11-16)', async () => {
        const onAvenia = resolveAddMoneyMethods({
            cryptoReady: true,
            standingEnabled: true,
            brazilPaused: false,
            residenceIso2s: ['BR'],
            activeAccounts: [],
            readyTopUps: [],
            firstPaymentAt: '2026-01-01T00:00:00Z',
            pixDepositOffered: true,
        })
        renderWithUrl('?drawer=add', undefined, onAvenia)

        const pix = screen.getByTestId('home-drawer-add-pix')
        const crypto = screen.getByTestId('home-drawer-add-crypto')
        expect(pix.compareDocumentPosition(crypto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

        fireEvent.click(pix)
        // Pix has one currency: no chooser of one BRL row in between (TASK-25033)
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money/pix'))
    })

    // The owner, 24 Nov (TASK-25350). Which peso gates offer the row: useAddMoneyReadiness.test.ts
    describe('the ARS row', () => {
        const argentina = resolveAddMoneyMethods({
            cryptoReady: true,
            standingEnabled: true,
            brazilPaused: false,
            residenceIso2s: ['AR'],
            activeAccounts: [],
            readyTopUps: ['ARS'],
        })

        it('leads the drawer with the AR flag and opens the peso top-up directly', async () => {
            const urlUpdates: UrlUpdateEvent[] = []
            renderWithUrl('?drawer=add', (event) => urlUpdates.push(event), argentina)

            const rows = screen.getAllByTestId(/^home-drawer-add-/)
            expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
                'home-drawer-add-ars',
                'home-drawer-add-bank',
                'home-drawer-add-crypto',
            ])
            expect(rows[0]).toHaveTextContent('ARS')
            expect(decodeURIComponent(rows[0].querySelector('img')?.getAttribute('src') ?? '')).toContain(
                '/flags/ar.svg'
            )

            fireEvent.click(rows[0])
            // one currency: no chooser of one ARS row in between
            await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money/argentina/manteca'))
            expect(urlUpdates.at(-1)?.searchParams.get('drawer')).toBeNull()
        })

        it('carries returnTo onto the peso top-up', async () => {
            const origin = '/profile/exchange-rate?from=USD&to=ARS'
            renderWithUrl(`?drawer=add&returnTo=${encodeURIComponent(origin)}`, undefined, argentina)
            fireEvent.click(screen.getByTestId('home-drawer-add-ars'))
            await waitFor(() =>
                expect(mockPush).toHaveBeenCalledWith(
                    `/add-money/argentina/manteca?returnTo=${encodeURIComponent(origin)}`
                )
            )
        })

        it('opens the native form of the top-up in the app, which has no country route', async () => {
            jest.mocked(isCapacitor).mockReturnValue(true)
            renderWithUrl('?drawer=add', undefined, argentina)
            fireEvent.click(screen.getByTestId('home-drawer-add-ars'))
            await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money?country=argentina&view=manteca'))
        })
    })

    it('does not redirect or show stale rows while an old Add link checks readiness', () => {
        render(<HomeActionDrawers addMoney={{ ...firstTime, isLoading: true }} />, {
            wrapper: withNuqsTestingAdapter({ searchParams: '?drawer=add' }),
        })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('routes an old Add drawer link to the full picker for a first-time user', async () => {
        const origin = '/profile/exchange-rate?from=USD&to=EUR'
        renderWithUrl(`?drawer=add&returnTo=${encodeURIComponent(origin)}`, undefined, firstTime)
        await waitFor(() =>
            expect(mockReplace).toHaveBeenCalledWith(`/add-money?returnTo=${encodeURIComponent(origin)}`)
        )
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

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

    it('carries a query-bearing returnTo onto the bank hub', async () => {
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
                <HomeActionDrawers addMoney={{ ...returning, isLoading: false }} />
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
                <HomeActionDrawers addMoney={{ ...returning, isLoading: false }} />
            </>,
            { wrapper: withNuqsTestingAdapter({ searchParams: '' }) }
        )
        expect(screen.getByTestId('nav-hidden')).toHaveTextContent('false')
    })
})

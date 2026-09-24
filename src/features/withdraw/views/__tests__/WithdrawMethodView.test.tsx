/**
 * WithdrawMethodView — the method-select step that mutates the withdraw
 * flow's shared destination state (Chip review round 7). Pins what the
 * deleted AddWithdrawRouterView test used to cover:
 *  (a) a saved Manteca account forwards destination=<identifier> and
 *      isSavedAccount=true into /withdraw/manteca (skipping the shared
 *      amount step);
 *  (b) a saved non-Manteca account sets selectedBankAccount and advances to
 *      the amount step WITHOUT navigating;
 *  (c) crypto opens destination selection before amount entry.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { type Account } from '@/interfaces/interfaces'

// ---------- module-level mocks ----------

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, back: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/withdraw',
}))

jest.mock('next-intl', () => ({
    useTranslations: (ns: string) => {
        const t = (key: string) => `${ns}.${key}`
        t.rich = (key: string) => `${ns}.${key}`
        return t
    },
}))

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), init: jest.fn() },
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: { WITHDRAW_METHOD_SELECTED: 'withdraw_method_selected' },
}))

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: (props: { onClick?: () => void; children?: React.ReactNode }) => (
        <button onClick={props.onClick}>{props.children}</button>
    ),
}))
jest.mock('@/components/0_Bruddle/IconBubble', () => ({ IconBubble: () => null }))
jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
}))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ onPrev }: { onPrev?: () => void }) => (
        <button data-testid="nav-back" onClick={onPrev}>
            Back
        </button>
    ),
}))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div data-testid="loading" /> }))

// SavedAccountsView: expose the callbacks the view wires up
jest.mock('@/components/Common/SavedAccountsView', () => ({
    __esModule: true,
    default: (props: {
        savedAccounts: Account[]
        onAccountClick: (account: Account, path?: string) => void
        onCryptoClick?: () => void
        onSelectNewMethodClick: () => void
        savedAddresses: { id: string; address: string; chainId: string; nickname: string }[]
        onSavedAddressClick: (saved: { id: string; address: string; chainId: string; nickname: string }) => void
    }) => (
        <div>
            <button data-testid="hub-bank-row" onClick={props.onSelectNewMethodClick}>
                Withdraw to a bank account
            </button>
            {props.savedAccounts.map((account) => (
                <button
                    key={account.identifier}
                    data-testid={`account-${account.identifier}`}
                    onClick={() => props.onAccountClick(account)}
                >
                    {account.identifier}
                </button>
            ))}
            {props.savedAddresses.map((saved) => (
                <button
                    key={saved.id}
                    data-testid={`saved-address-${saved.id}`}
                    onClick={() => props.onSavedAddressClick(saved)}
                >
                    {saved.nickname}
                </button>
            ))}
            {props.onCryptoClick && (
                <button data-testid="crypto-row" onClick={props.onCryptoClick}>
                    Crypto
                </button>
            )}
        </div>
    ),
}))
// The currency-first selector is now the method view's all-methods screen. Its
// own currency/country/disambiguation behaviour is unit-tested in
// WithdrawCurrencyList.test.tsx; here it is stubbed to the country + crypto
// callbacks the routing tests drive, so these tests pin WithdrawMethodView's
// routing (`handleCountrySelected`), not the picker's internals.
jest.mock('@/features/withdraw/components/WithdrawCurrencyList', () => ({
    WithdrawCurrencyList: ({
        onCountryClick,
        onCryptoClick,
        enforceSupportedCountries,
        initialQuery,
        pendingPath,
    }: {
        onCountryClick: (c: unknown) => void
        onCryptoClick?: () => void
        enforceSupportedCountries?: boolean
        initialQuery?: string
        pendingPath?: string | null
    }) => (
        <div
            data-testid="currency-list"
            data-send-gate={String(!!enforceSupportedCountries)}
            data-initial-query={initialQuery}
            data-pending-path={pendingPath ?? ''}
        >
            {[
                { id: 'SEPA', path: 'euro-area', currency: 'EUR', title: 'Euro bank account' },
                { id: 'DE', path: 'germany', currency: 'EUR', title: 'Germany' },
                { id: 'AR', path: 'argentina', currency: 'ARS', title: 'Argentina' },
                { id: 'BR', path: 'brazil', currency: 'BRL', title: 'Brazil' },
                { id: 'IN', path: 'india', currency: 'INR', title: 'India' },
            ].map((country) => (
                <button
                    key={country.id}
                    data-testid={`country-${country.path}`}
                    onClick={() => onCountryClick(country)}
                >
                    {country.title}
                </button>
            ))}
            {onCryptoClick && (
                <button data-testid="currency-crypto-row" onClick={onCryptoClick}>
                    Crypto
                </button>
            )}
        </div>
    ),
}))

// what each country leaves the user to choose: Germany one bank rail, Brazil
// one Manteca rail, Argentina one, India none live
jest.mock('@/features/destinations/country-rails', () => ({
    soleLiveRailForCountry: (id: string) =>
        ({
            DE: { id: 'de-default-bank-withdraw', title: 'To Bank' },
            AR: {
                id: 'ar-default-bank-withdraw',
                title: 'To Bank',
                path: '/withdraw/manteca?method=bank-transfer&country=argentina',
            },
            BR: { id: 'br-pix-withdraw', title: 'Pix', path: '/withdraw/manteca?method=pix&country=brazil' },
        })[id] ?? null,
}))
jest.mock('@/features/destinations/DestinationEditDrawer', () => ({
    __esModule: true,
    default: () => null,
}))

// address book: one saved Base entry so its taps can be asserted
const mockSavedBaseAddress = {
    id: 'saved-1',
    address: '0x9999999999999999999999999999999999999999',
    chainId: '8453',
    nickname: 'Binance',
    lastUsedAt: '2026-09-01T00:00:00Z',
}
let mockSavedAddresses: (typeof mockSavedBaseAddress)[] = [mockSavedBaseAddress]
jest.mock('@/hooks/useSavedAddresses', () => ({
    useSavedAddresses: () => ({
        savedAddresses: mockSavedAddresses,
        isLoading: false,
        findSaved: () => undefined,
        rename: { mutateAsync: jest.fn() },
        remove: { mutateAsync: jest.fn() },
    }),
}))

const mockSetSelectedChainID = jest.fn()
const mockSetSelectedTokenAddress = jest.fn()
jest.mock('@/context/tokenSelector.context', () => {
    const react = jest.requireActual<typeof import('react')>('react')
    return {
        tokenSelectorContext: react.createContext({
            setSelectedChainID: (id: string) => mockSetSelectedChainID(id),
            setSelectedTokenAddress: (address: string) => mockSetSelectedTokenAddress(address),
            supportedChainsAndTokens: {
                '8453': {
                    chainId: '8453',
                    networkName: 'Base',
                    chainIconURI: '',
                    tokens: [
                        { address: '0xweth', symbol: 'WETH' },
                        { address: '0xusdc-on-base', symbol: 'USDC' },
                    ],
                },
            },
        }),
    }
})

jest.mock('@/hooks/useGeoFilteredPaymentOptions', () => ({
    useGeoFilteredPaymentOptions: () => ({ filteredMethods: [], isLoading: false }),
}))
jest.mock('@/hooks/useSendFlowOrigin', () => ({
    useSendFlowOrigin: () => ({ isBankFromSend: mockIsBankFromSend }),
}))
jest.mock('@/utils/general.utils', () => ({
    getFromLocalStorage: () => null,
}))
jest.mock('@/utils/native-routes', () => ({
    withdrawCountryUrl: (path: string, qs = '') => `/withdraw/${path}${qs}`,
    rewriteMethodPath: jest.requireActual('@/utils/native-routes').rewriteMethodPath,
}))

const MANTECA_ACCOUNT = {
    type: 'manteca',
    identifier: 'cbu-12345678901234567890',
    details: { countryName: 'argentina' },
} as unknown as Account
const IBAN_ACCOUNT = {
    type: 'iban',
    identifier: 'DE89370400440532013000',
    details: { countryName: 'germany' },
} as unknown as Account

const BANK_ACCOUNTS = [
    { type: 'manteca', identifier: 'cbu-12345678901234567890', details: { countryName: 'argentina' } },
    { type: 'iban', identifier: 'DE89370400440532013000', details: { countryName: 'germany' } },
]
let mockUserAccounts: unknown[] = BANK_ACCOUNTS
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { accounts: mockUserAccounts } }),
}))

const mockSetSelectedBankAccount = jest.fn()
const mockSetSelectedMethod = jest.fn()
const mockSetRecipient = jest.fn()
const mockSetIsValidRecipient = jest.fn()
jest.mock('@/features/withdraw/WithdrawFlowContext', () => ({
    useWithdrawFlow: () => ({
        setSelectedBankAccount: mockSetSelectedBankAccount,
        setSelectedMethod: mockSetSelectedMethod,
        setRecipient: mockSetRecipient,
        setIsValidRecipient: mockSetIsValidRecipient,
    }),
}))

import { WithdrawMethodView } from '../WithdrawMethodView'

// ---------- helpers ----------

let mockIsBankFromSend = false
const mockOnExit = jest.fn()
const mockOnMethodChosen = jest.fn()

const renderView = (searchParams: Record<string, string> = {}) =>
    render(
        <NuqsTestingAdapter searchParams={searchParams}>
            <WithdrawMethodView pageTitle="Withdraw" onExit={mockOnExit} onMethodChosen={mockOnMethodChosen} />
        </NuqsTestingAdapter>
    )

beforeEach(() => {
    jest.clearAllMocks()
    mockIsBankFromSend = false
    mockUserAccounts = BANK_ACCOUNTS
    mockSavedAddresses = [mockSavedBaseAddress]
})

// ---------- tests ----------

import { stashScannedDestination, takeScannedDestination } from '@/features/withdraw/destination'

describe('WithdrawMethodView — destination state and routing (Chip review round 7)', () => {
    it('a saved Manteca account forwards destination + isSavedAccount into /withdraw/manteca', () => {
        renderView()
        fireEvent.click(screen.getByTestId(`account-${MANTECA_ACCOUNT.identifier}`))

        expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(
            expect.objectContaining({ identifier: MANTECA_ACCOUNT.identifier })
        )
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'manteca', countryPath: 'argentina' })
        )
        const pushed = mockRouterPush.mock.calls.at(-1)?.[0] as string
        expect(pushed).toContain('/withdraw/manteca?')
        expect(pushed).toContain('country=argentina')
        expect(pushed).toContain(`destination=${MANTECA_ACCOUNT.identifier}`)
        expect(pushed).toContain('isSavedAccount=true')
        // Manteca collects its amount locally — the shared amount step is skipped
        expect(mockOnMethodChosen).not.toHaveBeenCalled()
    })

    it('a saved non-Manteca account sets the flow state and advances WITHOUT navigating', () => {
        renderView()
        fireEvent.click(screen.getByTestId(`account-${IBAN_ACCOUNT.identifier}`))

        expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(
            expect.objectContaining({ identifier: IBAN_ACCOUNT.identifier })
        )
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'bridge', countryPath: 'germany' })
        )
        expect(mockOnMethodChosen).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('the crypto row sets the method in context and opens destination before amount', () => {
        // a pre-amount push trips the crypto page's no-amount redirect guard,
        // whose unmount cleanup resets the flow (the deleted
        // AddWithdrawRouterView test pinned this exact regression)
        renderView()
        fireEvent.click(screen.getByTestId('crypto-row'))

        expect(mockSetSelectedMethod).toHaveBeenCalledWith(expect.objectContaining({ type: 'crypto' }))
        expect(mockOnMethodChosen).not.toHaveBeenCalled()
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/crypto')
    })

    it('an address-book row preselects the saved chain + USDC and prefills a valid recipient', () => {
        // The saved network must survive into
        // the crypto screen, or an EVM address gets sent on the default chain
        // (Chip: preserve the saved destination network)
        renderView()
        fireEvent.click(screen.getByTestId(`saved-address-${mockSavedBaseAddress.id}`))

        expect(mockSetSelectedChainID).toHaveBeenCalledWith('8453')
        expect(mockSetSelectedTokenAddress).toHaveBeenCalledWith('0xusdc-on-base')
        expect(mockSetRecipient).toHaveBeenCalledWith({ name: undefined, address: mockSavedBaseAddress.address })
        expect(mockSetIsValidRecipient).toHaveBeenCalledWith(true)
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(expect.objectContaining({ type: 'crypto' }))
        expect(mockOnMethodChosen).not.toHaveBeenCalled()
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/crypto')
    })

    it('the plain crypto row clears any address-book prefill before selecting the method', () => {
        renderView()
        fireEvent.click(screen.getByTestId('crypto-row'))

        expect(mockSetRecipient).toHaveBeenCalledWith({ name: undefined, address: '' })
        expect(mockSetIsValidRecipient).toHaveBeenCalledWith(false)
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(expect.objectContaining({ type: 'crypto' }))
    })

    // A destination the user picks by hand must not be overwritten later by one a
    // scan is still offering (TASK-22251, Chip review).
    it.each([
        ['an address-book row', () => screen.getByTestId(`saved-address-${mockSavedBaseAddress.id}`)],
        ['the plain crypto row', () => screen.getByTestId('crypto-row')],
    ])('%s drops a pending scanned destination', (_case, row) => {
        const scanId = stashScannedDestination('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'solana')
        expect(scanId).toBeTruthy()

        renderView()
        fireEvent.click(row())

        expect(takeScannedDestination(scanId)).toBeNull()
    })
})

/**
 * The country pick (TASK-22589). A country with one live rail has nothing to
 * choose, so the one-row per-country list is skipped; a country with several
 * still shows them, once.
 */
describe('WithdrawMethodView — picking a country', () => {
    it('one live bank rail: straight to the bank form, named in the URL', () => {
        renderView({ showAll: 'true' })
        fireEvent.click(screen.getByTestId('country-germany'))

        expect(mockSetSelectedMethod).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'bridge', countryPath: 'germany', title: 'To Bank' })
        )
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/germany?step=form')
    })

    it('one live Manteca rail: straight to that flow, with no amount to seed', () => {
        renderView({ showAll: 'true' })
        fireEvent.click(screen.getByTestId('country-brazil'))

        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/manteca?method=pix&country=brazil')
    })

    it('several live rails: the per-country list still gets shown', () => {
        renderView({ showAll: 'true' })
        fireEvent.click(screen.getByTestId('country-argentina'))

        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/manteca?method=bank-transfer&country=argentina')
        expect(mockSetSelectedMethod).not.toHaveBeenCalled()
    })

    it('no live rail: the per-country list shows the coming-soon state', () => {
        renderView({ showAll: 'true' })
        fireEvent.click(screen.getByTestId('country-india'))

        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/india')
    })
})

it('preserves the bank rail and Send origin through the real URL helper', () => {
    mockIsBankFromSend = true
    renderView({ showAll: 'true', method: 'bank' })
    // Brazil, not Argentina: the send-to-bank list never offers Argentina
    fireEvent.click(screen.getByTestId('country-brazil'))
    expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/manteca?method=pix&country=brazil&sendMethod=bank')
})

describe('WithdrawMethodView — what it tells the currency list', () => {
    it('send-to-bank turns the country gate on; own-account withdraw leaves it off', () => {
        mockIsBankFromSend = true
        const { unmount } = renderView({ showAll: 'true', method: 'bank' })
        expect(screen.getByTestId('currency-list')).toHaveAttribute('data-send-gate', 'true')
        unmount()

        mockIsBankFromSend = false
        renderView({ showAll: 'true' })
        expect(screen.getByTestId('currency-list')).toHaveAttribute('data-send-gate', 'false')
    })

    it('/withdraw?currencyCode=EUR opens the list filtered to that currency', () => {
        renderView({ currencyCode: 'EUR' })
        expect(screen.getByTestId('currency-list')).toHaveAttribute('data-initial-query', 'EUR')
    })
})

/**
 * Round-2 QA (Q1): "why is crypto an option when I've choose withdraw to bank?"
 * A chooser must not offer a method the user already picked one screen earlier.
 */
describe('WithdrawMethodView — the chooser drops a rail the user already picked', () => {
    it('the hub bank row names the rail in the URL', async () => {
        const onUrlUpdate = jest.fn()
        render(
            <NuqsTestingAdapter onUrlUpdate={onUrlUpdate}>
                <WithdrawMethodView pageTitle="Withdraw" onExit={mockOnExit} onMethodChosen={mockOnMethodChosen} />
            </NuqsTestingAdapter>
        )
        fireEvent.click(screen.getByTestId('hub-bank-row'))

        await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
        const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams as URLSearchParams
        expect(params.get('showAll')).toBe('true')
        expect(params.get('rail')).toBe('bank')
    })

    it('bank chosen upstream: no crypto row', () => {
        renderView({ showAll: 'true', rail: 'bank' })
        expect(screen.queryByTestId('currency-crypto-row')).not.toBeInTheDocument()
        // the bank side of the screen is untouched
        expect(screen.getByTestId('country-germany')).toBeInTheDocument()
    })

    it('Send → Bank is the same choice, made one screen earlier', () => {
        mockIsBankFromSend = true
        renderView({ showAll: 'true', method: 'bank' })
        expect(screen.queryByTestId('currency-crypto-row')).not.toBeInTheDocument()
    })

    // QA 2026-09-24 (QA-30): Send → Bank listed the crypto address book under
    // the saved bank accounts.
    it('Send → Bank with saved accounts: the bank accounts only, no address book and no crypto row', () => {
        mockIsBankFromSend = true
        renderView({ method: 'bank' })
        expect(screen.getByTestId('account-DE89370400440532013000')).toBeInTheDocument()
        expect(screen.queryByTestId('saved-address-saved-1')).not.toBeInTheDocument()
        expect(screen.queryByTestId('crypto-row')).not.toBeInTheDocument()
    })

    it('Send → Bank with only crypto addresses saved: straight to the bank list', () => {
        mockIsBankFromSend = true
        mockUserAccounts = []
        renderView({ method: 'bank' })
        expect(screen.getByTestId('currency-list')).toBeInTheDocument()
        expect(screen.queryByTestId('saved-address-saved-1')).not.toBeInTheDocument()
    })

    it('own-account withdraw keeps both rails on the saved screen', () => {
        renderView()
        expect(screen.getByTestId('saved-address-saved-1')).toBeInTheDocument()
        expect(screen.getByTestId('crypto-row')).toBeInTheDocument()
    })

    it('no rail chosen: the crypto row still leads the list', () => {
        renderView({ showAll: 'true' })
        expect(screen.getByTestId('currency-crypto-row')).toBeInTheDocument()
    })
})

// Staging 2026-09-24: Withdraw → Crypto went to an empty destination form while
// the user had saved addresses. The address book must come first on Withdraw;
// Send → Bank still never shows it (QA-30).
describe('WithdrawMethodView — Withdraw → Crypto shows the address book first', () => {
    const renderWithMemory = (searchParams: Record<string, string>) =>
        render(
            <NuqsTestingAdapter searchParams={searchParams} hasMemory>
                <WithdrawMethodView
                    pageTitle="Withdraw"
                    mainHeading="Where to?"
                    onExit={mockOnExit}
                    onMethodChosen={mockOnMethodChosen}
                />
            </NuqsTestingAdapter>
        )

    it('Crypto on the full list, with saved addresses: the saved addresses, not the form', async () => {
        renderWithMemory({ showAll: 'true' })
        fireEvent.click(screen.getByTestId('currency-crypto-row'))

        expect(await screen.findByTestId(`saved-address-${mockSavedBaseAddress.id}`)).toBeInTheDocument()
        expect(screen.getByTestId('crypto-row')).toBeInTheDocument()
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('Crypto on the full list, nothing saved: straight to the destination form', () => {
        mockSavedAddresses = []
        mockUserAccounts = []
        renderView({ showAll: 'true' })
        fireEvent.click(screen.getByTestId('currency-crypto-row'))

        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/crypto')
    })

    it('only crypto addresses saved: back from the bank list returns to them, not out of Withdraw', async () => {
        mockUserAccounts = []
        renderWithMemory({ showAll: 'true', rail: 'bank' })
        fireEvent.click(screen.getByTestId('nav-back'))

        expect(await screen.findByTestId(`saved-address-${mockSavedBaseAddress.id}`)).toBeInTheDocument()
        expect(mockOnExit).not.toHaveBeenCalled()
    })

    it('Send → Bank: back from the bank list still leaves, the address book stays hidden', () => {
        mockIsBankFromSend = true
        mockUserAccounts = []
        renderView({ showAll: 'true', method: 'bank' })
        fireEvent.click(screen.getByTestId('nav-back'))

        expect(mockOnExit).toHaveBeenCalled()
        expect(screen.queryByTestId(`saved-address-${mockSavedBaseAddress.id}`)).not.toBeInTheDocument()
    })
})

/**
 * Round-2 QA (Q2): the euro area is one destination, not forty countries.
 * The country step is gone for EUR — the IBAN says which country it is.
 */
describe('WithdrawMethodView — the euro area routes with no country', () => {
    it('sends the euro destination straight to the euro bank form', () => {
        renderView({ showAll: 'true' })
        fireEvent.click(screen.getByTestId('country-euro-area'))

        expect(mockSetSelectedMethod).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'bridge', countryPath: 'euro-area', currency: 'EUR' })
        )
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/euro-area?step=form')
    })

    it('keeps the Send origin on the way to the euro form', () => {
        mockIsBankFromSend = true
        renderView({ showAll: 'true', method: 'bank' })
        fireEvent.click(screen.getByTestId('country-euro-area'))

        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/euro-area?step=form&method=bank')
    })

    it('a named country still routes to that country, so the list stays an escape hatch', () => {
        renderView({ showAll: 'true' })
        fireEvent.click(screen.getByTestId('country-germany'))

        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/germany?step=form')
    })
})

/**
 * Round-5 QA: tapping EUR took about two seconds on staging.
 *
 * Every destination here lands on /withdraw/[country], a dynamic route that is
 * fetched at tap time: measured on a production build at 375x667 with Fast 4G
 * throttling, 461ms passes between the tap and the first usable field, and on
 * staging it is about two seconds. Until that fetch is cheaper, the screen at
 * least says it heard the tap, and takes no second one.
 */
describe('WithdrawMethodView — the tap is acknowledged while the route loads', () => {
    it('marks the tapped row as pending, so the wait is shown where the user pressed', () => {
        renderView({ showAll: 'true' })
        fireEvent.click(screen.getByTestId('country-euro-area'))

        expect(screen.getByTestId('currency-list')).toHaveAttribute('data-pending-path', 'euro-area')
    })

    it('ignores a second tap while the first is still navigating', () => {
        renderView({ showAll: 'true' })
        fireEvent.click(screen.getByTestId('country-euro-area'))
        fireEvent.click(screen.getByTestId('country-germany'))

        // the first answer stands: Germany never becomes a second navigation
        expect(mockRouterPush).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/euro-area?step=form')
    })
})

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
import { render, screen, fireEvent } from '@testing-library/react'
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
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div data-testid="loading" /> }))

// SavedAccountsView: expose the callbacks the view wires up
jest.mock('@/components/Common/SavedAccountsView', () => ({
    __esModule: true,
    default: (props: {
        savedAccounts: Account[]
        onAccountClick: (account: Account, path?: string) => void
        onCryptoClick: () => void
        savedAddresses: { id: string; address: string; chainId: string; nickname: string }[]
        onSavedAddressClick: (saved: { id: string; address: string; chainId: string; nickname: string }) => void
    }) => (
        <div>
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
            <button data-testid="crypto-row" onClick={props.onCryptoClick}>
                Crypto
            </button>
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
    }: {
        onCountryClick: (c: unknown) => void
        onCryptoClick: () => void
    }) => (
        <div>
            {[
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
            <button data-testid="currency-crypto-row" onClick={onCryptoClick}>
                Crypto
            </button>
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
jest.mock('@/hooks/useSavedAddresses', () => ({
    useSavedAddresses: () => ({
        savedAddresses: [mockSavedBaseAddress],
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

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: {
            accounts: [
                { type: 'manteca', identifier: 'cbu-12345678901234567890', details: { countryName: 'argentina' } },
                { type: 'iban', identifier: 'DE89370400440532013000', details: { countryName: 'germany' } },
            ],
        },
    }),
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
            <WithdrawMethodView
                pageTitle="Withdraw"
                mainHeading="Where to?"
                onExit={mockOnExit}
                onMethodChosen={mockOnMethodChosen}
            />
        </NuqsTestingAdapter>
    )

beforeEach(() => {
    jest.clearAllMocks()
    mockIsBankFromSend = false
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
    fireEvent.click(screen.getByTestId('country-argentina'))
    expect(mockRouterPush).toHaveBeenCalledWith(
        '/withdraw/manteca?method=bank-transfer&country=argentina&sendMethod=bank'
    )
})

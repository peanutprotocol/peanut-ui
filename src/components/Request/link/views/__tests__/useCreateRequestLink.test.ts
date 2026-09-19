/**
 * @jest-environment jsdom
 */
import { act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { renderHook } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { createElement, type ReactNode } from 'react'

// nuqs needs its adapter above the hook; intl stays inside it
const NuqsAdapter = withNuqsTestingAdapter({ searchParams: '' })
const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(NuqsAdapter, null, createElement(IntlWrapper, null, children))
// The split-bill CTA prefills `?amount=&merchant=` (buildSplitBillRequestUrl).
// A dedicated wrapper carries those into the hook via the same nuqs adapter.
const splitBillWrapper = ({ children }: { children: ReactNode }) =>
    createElement(
        withNuqsTestingAdapter({ searchParams: '?amount=25&merchant=Tigers%20%26%20Lions' }),
        null,
        createElement(IntlWrapper, null, children)
    )
// A request asked in another currency arrives the same way: `?currency=EUR`.
const currencyWrapper = (searchParams: string) => {
    // built once: an adapter made per render is a new component type, and a
    // rerender would remount the hook under test
    const Adapter = withNuqsTestingAdapter({ searchParams })
    const CurrencyWrapper = ({ children }: { children: ReactNode }) =>
        createElement(Adapter, null, createElement(IntlWrapper, null, children))
    return CurrencyWrapper
}
import { ApiError } from '@/services/api-error'
import { useCreateRequestLink } from '../useCreateRequestLink'

// units of the request currency per dollar
let mockExchangeRate = 0
const useExchangeRate = jest.fn()
jest.mock('@/hooks/useExchangeRate', () => ({
    useExchangeRate: (args: unknown) => {
        useExchangeRate(args)
        return { exchangeRate: mockExchangeRate }
    },
}))

const toastSuccess = jest.fn()
const toastError = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ success: toastSuccess, error: toastError }),
}))

jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        address: '0xrecipient',
        isConnected: true,
        spendableBalance: 100n,
        formattedSpendableBalance: '$100.00',
    }),
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { username: 'kush' }, accounts: [] } }),
}))

jest.mock('@/context/tokenSelector.context', () => {
    const { createContext } = jest.requireActual('react')
    return {
        tokenSelectorContext: createContext({
            selectedChainID: '42161',
            setSelectedChainID: jest.fn(),
            selectedTokenAddress: '0xusdc',
            setSelectedTokenAddress: jest.fn(),
            selectedTokenData: { chainId: '42161', address: '0xusdc', decimals: 6, symbol: 'USDC', price: 1 },
        }),
    }
})

const setLoadingState = jest.fn()
jest.mock('@/context/loadingStates.context', () => {
    const { createContext } = jest.requireActual('react')
    return { loadingStateContext: createContext({ setLoadingState: (...a: unknown[]) => setLoadingState(...a) }) }
})

const invalidateQueries = jest.fn()
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries }) }))

const apiCreate = jest.fn()
const apiUpdate = jest.fn()
const apiClose = jest.fn()
jest.mock('@/services/requests', () => ({
    requestsApi: {
        create: (...a: unknown[]) => apiCreate(...a),
        update: (...a: unknown[]) => apiUpdate(...a),
        close: (...a: unknown[]) => apiClose(...a),
    },
}))

const resolveCopy = jest.fn()
const cancelCopy = jest.fn()
jest.mock('@/utils/clipboard.utils', () => ({
    beginClipboardCopy: () => ({ resolve: resolveCopy, cancel: cancelCopy }),
}))

jest.mock('@/app/actions/tokens', () => ({ fetchTokenDetails: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
// identity debounce keeps the autosave path synchronous in tests
jest.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: unknown) => value }))
jest.mock('@/constants/harness.consts', () => ({ HARNESS_ENABLED: false }))
jest.mock('@/constants/zerodev.consts', () => ({ PEANUT_WALLET_CHAIN: { id: 42161 }, PEANUT_WALLET_TOKEN: '0xusdc' }))
jest.mock('@/utils/general.utils', () => ({
    fetchTokenSymbol: jest.fn(),
    formatTokenAmount: (amount: string) => amount,
    getRequestLink: ({ uuid }: { uuid: string }) => `https://peanut.me/request/pay?id=${uuid}`,
    isNativeCurrency: () => false,
}))
jest.mock('@/utils/url.utils', () => ({
    payLinkUrl: (path: string) => `https://peanut.me${path}`,
    shareableUrl: (path: string) => `https://peanut.me${path}`,
}))

// The bank opt-in default reads the payable account's sender policy, but only
// for an account the payer could actually be given — canShare(account, gate).
// Mock the deposit hook with per-corridor gates; the real `firstPayableCorridor`
// still picks the account.
let mockDepositAccountsEnabled = true
let mockDepositAccounts: Record<
    string,
    { status: string; currency?: string; matching: { sender: string }; instructions?: unknown } | undefined
> = {}
let mockDepositGates: Record<string, { kind: string }> = {}
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => mockDepositAccountsEnabled,
}))
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    useDepositAccounts: () => ({ accounts: mockDepositAccounts, gates: mockDepositGates }),
}))
const activeAccount = (sender: string, currency = 'EUR') => ({
    status: 'active',
    currency,
    matching: { sender },
    instructions: { railId: 'bridge.sepa_eu' },
})

describe('useCreateRequestLink', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        apiCreate.mockResolvedValue({ uuid: 'req-1' })
        apiClose.mockResolvedValue({ uuid: 'req-1' })
        resolveCopy.mockResolvedValue(true)
        mockExchangeRate = 0
        mockDepositAccountsEnabled = true
        mockDepositAccounts = {}
        mockDepositGates = new Proxy({}, { get: () => ({ kind: 'ready' }) }) as Record<string, { kind: string }>
    })

    describe('the bank opt-in default', () => {
        it('starts on when the payable account takes anyone', () => {
            mockDepositAccounts = { SEPA_EU: activeAccount('anyone') }
            const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
            expect(result.current.bankInstructionsShared).toBe(true)
        })

        it('starts off when only a business may pay', () => {
            mockDepositAccounts = { FASTER_PAYMENTS_GB: activeAccount('business-only') }
            const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
            expect(result.current.bankInstructionsShared).toBe(false)
        })

        it('starts off when only the holder may pay', () => {
            mockDepositAccounts = { SEPA_EU: activeAccount('own-name-only') }
            const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
            expect(result.current.bankInstructionsShared).toBe(false)
        })

        it('starts off when no account can receive the money', () => {
            const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
            expect(result.current.bankInstructionsShared).toBe(false)
        })

        it('starts off when the payable account’s corridor gate is blocked', () => {
            mockDepositAccounts = { SEPA_EU: activeAccount('anyone') }
            mockDepositGates = { SEPA_EU: { kind: 'needs-identity' } }
            const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
            expect(result.current.bankInstructionsShared).toBe(false)
        })

        it('reads the account the payer is given, in catalogue order', () => {
            mockDepositAccounts = {
                ACH_US: activeAccount('business-only'),
                SEPA_EU: activeAccount('anyone'),
            }
            const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
            // SEPA_EU comes first in DEPOSIT_RAIL_ORDER, so its 'anyone' wins.
            expect(result.current.bankInstructionsShared).toBe(true)
        })

        it('lets the user turn the default off and does not re-enable it', () => {
            mockDepositAccounts = { SEPA_EU: activeAccount('anyone') }
            const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
            expect(result.current.bankInstructionsShared).toBe(true)

            act(() => {
                result.current.setBankInstructionsShared(false)
            })
            expect(result.current.bankInstructionsShared).toBe(false)
        })
    })

    it('derives the profile pay link before a request exists', () => {
        const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
        expect(result.current.qrCodeLink).toBe('https://peanut.me/send/kush')

        act(() => {
            result.current.handleRequestAmountChange('5')
        })
        expect(result.current.qrCodeLink).toBe('https://peanut.me/kush/5USDC')
    })

    it('generateLink creates the request, stores the link, and toasts the copy result', async () => {
        const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
        act(() => {
            result.current.handleRequestAmountChange('5')
        })

        let link: string | undefined
        await act(async () => {
            link = await result.current.generateLink()
        })

        expect(apiCreate).toHaveBeenCalledWith(expect.objectContaining({ tokenAmount: '5', tokenSymbol: 'USDC' }))
        expect(link).toBe('https://peanut.me/request/pay?id=req-1')
        expect(result.current.generatedLink).toBe(link)
        expect(result.current.requestId).toBe('req-1')
        expect(result.current.qrCodeLink).toBe(link)
        expect(invalidateQueries).toHaveBeenCalled()
        expect(toastSuccess).toHaveBeenCalledTimes(1)
        expect(result.current.isCreatingLink).toBe(false)
    })

    it('a failed create surfaces the error state, cancels the copy, and returns empty', async () => {
        apiCreate.mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
        act(() => {
            result.current.handleRequestAmountChange('5')
        })

        let link: string | undefined
        await act(async () => {
            link = await result.current.generateLink()
        })

        expect(link).toBe('')
        expect(result.current.generatedLink).toBeNull()
        expect(result.current.errorState.showError).toBe(true)
        expect(cancelCopy).toHaveBeenCalled()
        expect(toastError).toHaveBeenCalled()
    })

    /**
     * After creation the amount field is disabled, so a change that still
     * arrives is the input re-rendering its own value: a currency swap,
     * "100.50" shown as "100.5", a refreshed FX rate. Each used to clear the
     * request, bring the Create button back, and the next tap made a duplicate.
     */
    it.each([['5.0'], ['4.99'], [''], [undefined]])(
        'keeps the created request when the input reports %p afterwards',
        async (echo) => {
            const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
            act(() => {
                result.current.handleRequestAmountChange('5')
            })
            await act(async () => {
                await result.current.generateLink()
            })
            expect(result.current.requestId).toBe('req-1')

            act(() => {
                result.current.handleRequestAmountChange(echo)
            })
            expect(result.current.requestId).toBe('req-1')
            expect(result.current.generatedLink).not.toBeNull()
            expect(result.current.requestAmount).toBe('5')
        }
    )

    it('still takes amount edits before a request exists', () => {
        const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
        act(() => {
            result.current.handleRequestAmountChange('5')
        })
        act(() => {
            result.current.handleRequestAmountChange('7')
        })
        expect(result.current.requestAmount).toBe('7')
    })

    // ui#3271 QA pass 2: this used to auto-call generateLink() the moment
    // `merchant` + `amount` were both present, skipping the create step where
    // BankInstructionsToggle lives — a split-bill request could never offer
    // bank-sharing. It must now behave exactly like any other prefilled
    // request: seed the form and wait for an explicit generateLink() call.
    it('does not auto-generate a split-bill request — it only prefills the form', () => {
        const { result } = renderHook(() => useCreateRequestLink(), { wrapper: splitBillWrapper })

        expect(result.current.tokenValue).toBe('25')
        expect(result.current.attachmentOptions.message).toBe('Bill split for Tigers & Lions')
        expect(result.current.requestId).toBeNull()
        expect(result.current.generatedLink).toBeNull()
        expect(apiCreate).not.toHaveBeenCalled()
    })

    it('autosaves attachment changes to an existing request', async () => {
        apiUpdate.mockResolvedValue({})
        const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
        act(() => {
            result.current.handleRequestAmountChange('5')
        })
        await act(async () => {
            await result.current.generateLink()
        })

        await act(async () => {
            result.current.handleAttachmentOptionsChange({ message: 'lunch', fileUrl: '', rawFile: undefined })
        })

        expect(apiUpdate).toHaveBeenCalledWith('req-1', expect.objectContaining({ reference: 'lunch' }))
        // The API refuses a changed amount or token on a request asked in a fiat
        // currency (409 REQUEST_AMOUNT_LOCKED). An update never carries either.
        const updateBody = apiUpdate.mock.calls[0][1]
        expect(updateBody).not.toHaveProperty('tokenAmount')
        expect(updateBody).not.toHaveProperty('tokenSymbol')
        expect(updateBody).not.toHaveProperty('requestedAmount')
    })

    describe('the request currency', () => {
        it('asks in dollars by default and sends no currency, so an older API takes the same body', async () => {
            const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
            expect(result.current.currency).toBe('USD')
            expect(useExchangeRate).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))

            act(() => {
                result.current.handleRequestAmountChange('5')
            })
            await act(async () => {
                await result.current.generateLink()
            })

            const body = apiCreate.mock.calls[0][0]
            expect(body.tokenAmount).toBe('5')
            expect(body).not.toHaveProperty('requestedAmount')
        })

        // The split-bill deep link names no currency and must stay a dollar request.
        it('keeps a split-bill deep link in dollars', () => {
            const { result } = renderHook(() => useCreateRequestLink(), { wrapper: splitBillWrapper })
            expect(result.current.currency).toBe('USD')
            expect(result.current.requestAmount).toBe('25')
            expect(result.current.tokenValue).toBe('25')
        })

        it('reads the currency and the amount from the url', () => {
            mockExchangeRate = 0.8
            const { result } = renderHook(() => useCreateRequestLink(), {
                wrapper: currencyWrapper('?amount=100&currency=eur'),
            })

            expect(result.current.currency).toBe('EUR')
            expect(result.current.requestAmount).toBe('100')
            // 100 EUR at 0.8 EUR per dollar
            expect(result.current.tokenValue).toBe('125.00')
        })

        it('falls back to dollars for a currency the FX service does not quote', () => {
            const { result } = renderHook(() => useCreateRequestLink(), { wrapper: currencyWrapper('?currency=PLN') })
            expect(result.current.currency).toBe('USD')
        })

        it('sends the asked amount and currency, with the dollar estimate as tokenAmount', async () => {
            mockExchangeRate = 0.8
            const { result } = renderHook(() => useCreateRequestLink(), {
                wrapper: currencyWrapper('?currency=EUR'),
            })
            act(() => {
                result.current.handleRequestAmountChange('100')
            })
            await act(async () => {
                await result.current.generateLink()
            })

            expect(apiCreate).toHaveBeenCalledWith(
                expect.objectContaining({ tokenAmount: '125.00', requestedAmount: { amount: '100', currency: 'EUR' } })
            )
        })

        it('sends an amount the requester left as ".5" in the shape the API accepts', async () => {
            mockExchangeRate = 0.8
            apiCreate.mockResolvedValue({ uuid: 'req-1', currency: 'EUR', requestedAmount: '0.5' })
            const { result } = renderHook(() => useCreateRequestLink(), {
                wrapper: currencyWrapper('?currency=EUR'),
            })
            act(() => {
                result.current.handleRequestAmountChange('.5')
            })
            await act(async () => {
                await result.current.generateLink()
            })

            expect(apiCreate.mock.calls[0][0].requestedAmount).toEqual({ amount: '0.5', currency: 'EUR' })
        })

        /**
         * The amount field builds its dollar side from the rate. A refetch that
         * fails mid-typing used to take that side away, and the field threw on
         * the next keystroke while it was showing dollars.
         */
        it('keeps the last good rate when a refetch fails', () => {
            mockExchangeRate = 0.8
            const { result, rerender } = renderHook(() => useCreateRequestLink(), {
                wrapper: currencyWrapper('?currency=EUR'),
            })
            expect(result.current.exchangeRate).toBe(0.8)

            mockExchangeRate = 0
            rerender()
            expect(result.current.exchangeRate).toBe(0.8)
        })

        it('rounds up when the requester typed dollars on a non-dollar request', () => {
            mockExchangeRate = 0.84975
            const { result } = renderHook(() => useCreateRequestLink(), {
                wrapper: currencyWrapper('?currency=EUR'),
            })
            act(() => {
                result.current.handleAmountInputChange({ primary: '42.48', secondary: '50', displayed: '50' })
            })
            expect(result.current.requestAmount).toBe('42.49')
        })

        it('sends no currency on an open-amount request', async () => {
            mockExchangeRate = 0.8
            const { result } = renderHook(() => useCreateRequestLink(), {
                wrapper: currencyWrapper('?currency=EUR'),
            })
            await act(async () => {
                await result.current.generateLink()
            })

            expect(apiCreate.mock.calls[0][0]).not.toHaveProperty('requestedAmount')
        })

        /**
         * With no rate there is no dollar estimate to send. An API deployed
         * before `requestedAmount` strips that field, and a body with no
         * `tokenAmount` then creates an OPEN-amount request.
         */
        it('does not create a non-dollar request before the rate has loaded', async () => {
            const { result } = renderHook(() => useCreateRequestLink(), {
                wrapper: currencyWrapper('?currency=EUR'),
            })
            act(() => {
                result.current.handleRequestAmountChange('100')
            })
            await act(async () => {
                await result.current.generateLink()
            })

            expect(apiCreate).not.toHaveBeenCalled()
            expect(result.current.requestId).toBeNull()
            expect(result.current.errorState.showError).toBe(true)
        })

        /**
         * The older API does not refuse the field, it strips it, and answers
         * with a dollar request for the client's estimate.
         */
        it('closes and rejects a request the API created in dollars instead', async () => {
            mockExchangeRate = 0.8
            apiCreate.mockResolvedValue({ uuid: 'req-usd', tokenAmount: '125.00' })
            const { result } = renderHook(() => useCreateRequestLink(), {
                wrapper: currencyWrapper('?currency=EUR'),
            })
            act(() => {
                result.current.handleRequestAmountChange('100')
            })
            await act(async () => {
                await result.current.generateLink()
            })

            expect(apiClose).toHaveBeenCalledWith('req-usd')
            expect(result.current.requestId).toBeNull()
            expect(result.current.generatedLink).toBeNull()
            expect(result.current.errorState.showError).toBe(true)
        })

        it('still fails the create when the close fails too', async () => {
            mockExchangeRate = 0.8
            apiClose.mockRejectedValue(new Error('nope'))
            const { result } = renderHook(() => useCreateRequestLink(), {
                wrapper: currencyWrapper('?currency=EUR'),
            })
            act(() => {
                result.current.handleRequestAmountChange('100')
            })
            await act(async () => {
                await result.current.generateLink()
            })

            expect(result.current.requestId).toBeNull()
            expect(result.current.errorState.showError).toBe(true)
        })

        describe('a create the API refuses', () => {
            const createInEur = async (error: unknown) => {
                mockExchangeRate = 0.8
                apiCreate.mockRejectedValue(error)
                const { result } = renderHook(() => useCreateRequestLink(), {
                    wrapper: currencyWrapper('?currency=EUR'),
                })
                act(() => {
                    result.current.handleRequestAmountChange('100')
                })
                await act(async () => {
                    await result.current.generateLink()
                })
                return result.current.errorState.errorMessage
            }
            const apiError = (status: number, code?: string) => new ApiError('refused', { status, code })

            it.each(['FX_UNAVAILABLE', 'UNSUPPORTED_REQUEST_CURRENCY'])('says there is no rate on %s', async (code) => {
                expect(await createInEur(apiError(code === 'FX_UNAVAILABLE' ? 503 : 400, code))).toMatch(/no EUR rate/)
            })

            it('says the amount is not valid on INVALID_REQUESTED_AMOUNT', async () => {
                expect(await createInEur(apiError(400, 'INVALID_REQUESTED_AMOUNT'))).toMatch(/not valid in EUR/)
            })

            // An API that predates the field refuses the unknown property: a 400 with no code.
            it('says the currency is not available yet on an API without the field', async () => {
                expect(await createInEur(apiError(400))).toMatch(/Requests in EUR are not available yet/)
            })

            it('keeps the generic message for anything else', async () => {
                expect(await createInEur(new Error('boom'))).toBe('Failed to create link')
            })
        })

        it('changes the currency until the request exists, then locks it', async () => {
            mockExchangeRate = 0.8
            apiCreate.mockResolvedValue({ uuid: 'req-1', currency: 'EUR', requestedAmount: '100' })
            const { result } = renderHook(() => useCreateRequestLink(), { wrapper })

            act(() => {
                result.current.handleCurrencyChange('EUR')
            })
            expect(result.current.currency).toBe('EUR')

            act(() => {
                result.current.handleRequestAmountChange('100')
            })
            await act(async () => {
                await result.current.generateLink()
            })
            act(() => {
                result.current.handleCurrencyChange('GBP')
            })
            expect(result.current.currency).toBe('EUR')
        })

        it('lists the currencies of the requester’s active accounts first, once each', () => {
            mockDepositAccounts = {
                SEPA_EU: activeAccount('anyone', 'eur'),
                ACH_US: activeAccount('anyone', 'USD'),
                SPEI_MX: { ...activeAccount('anyone', 'MXN'), status: 'revoked' },
            }
            const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
            expect(result.current.accountCurrencies).toEqual(['EUR', 'USD'])
        })
    })
})

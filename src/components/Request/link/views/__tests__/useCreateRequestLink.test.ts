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
import { useCreateRequestLink } from '../useCreateRequestLink'

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
jest.mock('@/services/requests', () => ({
    requestsApi: {
        create: (...a: unknown[]) => apiCreate(...a),
        update: (...a: unknown[]) => apiUpdate(...a),
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
    { status: string; matching: { sender: string }; instructions?: unknown } | undefined
> = {}
let mockDepositGates: Record<string, { kind: string }> = {}
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => mockDepositAccountsEnabled,
}))
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    useDepositAccounts: () => ({ accounts: mockDepositAccounts, gates: mockDepositGates }),
}))
const activeAccount = (sender: string) => ({
    status: 'active',
    matching: { sender },
    instructions: { railId: 'bridge.sepa_eu' },
})

describe('useCreateRequestLink', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        apiCreate.mockResolvedValue({ uuid: 'req-1' })
        resolveCopy.mockResolvedValue(true)
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
            result.current.handleTokenValueChange('5')
        })
        expect(result.current.qrCodeLink).toBe('https://peanut.me/kush/5USDC')
    })

    it('generateLink creates the request, stores the link, and toasts the copy result', async () => {
        const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
        act(() => {
            result.current.handleTokenValueChange('5')
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
            result.current.handleTokenValueChange('5')
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

    it('changing the amount resets the generated request', async () => {
        const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
        act(() => {
            result.current.handleTokenValueChange('5')
        })
        await act(async () => {
            await result.current.generateLink()
        })
        expect(result.current.requestId).toBe('req-1')

        act(() => {
            result.current.handleTokenValueChange('7')
        })
        expect(result.current.requestId).toBeNull()
        expect(result.current.generatedLink).toBeNull()
    })

    it('autosaves attachment changes to an existing request', async () => {
        apiUpdate.mockResolvedValue({})
        const { result } = renderHook(() => useCreateRequestLink(), { wrapper })
        act(() => {
            result.current.handleTokenValueChange('5')
        })
        await act(async () => {
            await result.current.generateLink()
        })

        await act(async () => {
            result.current.handleAttachmentOptionsChange({ message: 'lunch', fileUrl: '', rawFile: undefined })
        })

        expect(apiUpdate).toHaveBeenCalledWith('req-1', expect.objectContaining({ reference: 'lunch' }))
    })
})

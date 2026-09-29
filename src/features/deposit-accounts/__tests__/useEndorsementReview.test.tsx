/**
 * A corridor review that waits on the user is finished on the provider's own
 * page, and the link for it comes from the claim. Identity verification cannot
 * grant the review, and the KYC start-action link is not scoped to it.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const capture = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...args: unknown[]) => capture(...args) } }))

const claimDepositAccount = jest.fn()
jest.mock('@/services/deposit-accounts', () => ({
    claimDepositAccount: (...args: unknown[]) => claimDepositAccount(...args),
}))

let native = false
const openExternalUrl = jest.fn(async (_url: string) => {})
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isNativeBridge: () => native,
    openExternalUrl: (url: string) => openExternalUrl(url),
}))

import { ApiError } from '@/services/api-error'
import { useEndorsementReview } from '../useEndorsementReview'

const PAGE = 'https://provider.example/review/cop'
const REQUIRED = { outcome: 'endorsement_required', requirements: { pending: [], missing: ['x'], issues: [] } }

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

const tab = () => ({ opener: {} as unknown, closed: false, close: jest.fn(), location: { href: '' } })
let reserved: ReturnType<typeof tab>

beforeEach(() => {
    jest.clearAllMocks()
    native = false
    client = new QueryClient()
    jest.spyOn(client, 'invalidateQueries')
    reserved = tab()
    jest.spyOn(window, 'open').mockImplementation(() => reserved as unknown as Window)
    jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => jest.restoreAllMocks())

describe('useEndorsementReview', () => {
    it('opens the page the claim returned, in the tab reserved inside the click', async () => {
        claimDepositAccount.mockResolvedValue({ ...REQUIRED, verificationUrl: PAGE })
        const { result } = renderHook(() => useEndorsementReview(), { wrapper })

        await act(() => result.current.start('BANK_TRANSFER_CO'))

        expect(claimDepositAccount).toHaveBeenCalledWith('BANK_TRANSFER_CO')
        // reserved before the request, so the browser still counts it as the click
        expect((window.open as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
            claimDepositAccount.mock.invocationCallOrder[0]
        )
        expect(reserved.location.href).toBe(PAGE)
        expect(reserved.opener).toBeNull()
        expect(result.current.needsSupport.size).toBe(0)
    })

    it('uses the in-app browser on native, and reserves no tab', async () => {
        native = true
        claimDepositAccount.mockResolvedValue({ ...REQUIRED, verificationUrl: PAGE })
        const { result } = renderHook(() => useEndorsementReview(), { wrapper })

        await act(() => result.current.start('BANK_TRANSFER_CO'))

        expect(window.open).not.toHaveBeenCalled()
        expect(openExternalUrl).toHaveBeenCalledWith(PAGE)
    })

    it('hands the corridor to support when the provider gives no page', async () => {
        claimDepositAccount.mockResolvedValue(REQUIRED)
        const { result } = renderHook(() => useEndorsementReview(), { wrapper })

        await act(() => result.current.start('BANK_TRANSFER_CO'))

        expect(reserved.close).toHaveBeenCalled()
        expect(result.current.needsSupport.has('BANK_TRANSFER_CO')).toBe(true)
    })

    it.each([['opened'], ['endorsement_pending']])(
        're-reads the accounts when the claim answers %s, because the review moved on',
        async (outcome) => {
            claimDepositAccount.mockResolvedValue({ outcome })
            const { result } = renderHook(() => useEndorsementReview(), { wrapper })

            await act(() => result.current.start('BANK_TRANSFER_CO'))

            expect(reserved.close).toHaveBeenCalled()
            expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['deposit-accounts'] })
            expect(result.current.needsSupport.size).toBe(0)
        }
    )

    it('reports a failure a retry may clear as retryable, and closes the blank tab', async () => {
        claimDepositAccount.mockRejectedValue(new Error('network'))
        const { result } = renderHook(() => useEndorsementReview(), { wrapper })

        await act(() => result.current.start('BANK_TRANSFER_CO'))

        expect(reserved.close).toHaveBeenCalled()
        expect(result.current.failedCorridor).toBe('BANK_TRANSFER_CO')
        expect(result.current.needsSupport.size).toBe(0)
        expect(result.current.startingCorridor).toBeUndefined()
    })

    /*
     * The start is the same POST the claim screen makes, so it fails the same
     * ways. Every one of them used to read "try again in a moment" beside a
     * retry button — including a provider refusal, whose own copy says that
     * trying again will not help.
     */
    it.each([
        ['the account cap', new ApiError('limit', { status: 409, code: 'DEPOSIT_ACCOUNT_LIMIT' })],
        ['a provider refusal', new ApiError('no', { status: 409, code: 'DEPOSIT_ACCOUNT_PROVIDER_REFUSED' })],
        ['a bare 409', new ApiError('conflict', { status: 409 })],
        ['a restricted residence', new ApiError('nope', { status: 403 })],
    ])('offers a person rather than a retry for %s', async (_, error) => {
        claimDepositAccount.mockRejectedValue(error)
        const { result } = renderHook(() => useEndorsementReview(), { wrapper })

        await act(() => result.current.start('BANK_TRANSFER_CO'))

        expect(result.current.needsSupport.has('BANK_TRANSFER_CO')).toBe(true)
        expect(result.current.failedCorridor).toBeUndefined()
    })

    it('keeps the retry for a rate limit, where waiting is the whole fix', async () => {
        claimDepositAccount.mockRejectedValue(new ApiError('slow down', { status: 429 }))
        const { result } = renderHook(() => useEndorsementReview(), { wrapper })

        await act(() => result.current.start('BANK_TRANSFER_CO'))

        expect(result.current.failedCorridor).toBe('BANK_TRANSFER_CO')
        expect(result.current.needsSupport.size).toBe(0)
    })

    it('reports the start and its outcome to the same funnel the claim screen feeds', async () => {
        claimDepositAccount.mockResolvedValue({ outcome: 'opened' })
        const { result } = renderHook(() => useEndorsementReview(), { wrapper })

        await act(() => result.current.start('BANK_TRANSFER_CO'))

        expect(capture).toHaveBeenCalledWith('deposit_account_claim_started', { corridor: 'BANK_TRANSFER_CO' })
        expect(capture).toHaveBeenCalledWith(
            'deposit_account_claimed',
            expect.objectContaining({ corridor: 'BANK_TRANSFER_CO' })
        )
    })

    it('reports a failed start too, so a start with no end is not a silent drop-off', async () => {
        claimDepositAccount.mockRejectedValue(new Error('network'))
        const { result } = renderHook(() => useEndorsementReview(), { wrapper })

        await act(() => result.current.start('BANK_TRANSFER_CO'))

        expect(capture).toHaveBeenCalledWith('deposit_account_claim_failed', {
            corridor: 'BANK_TRANSFER_CO',
            reason: 'network',
        })
    })

    it('navigates this tab when the pop-up was blocked', async () => {
        ;(window.open as jest.Mock).mockReturnValue(null)
        claimDepositAccount.mockResolvedValue({ ...REQUIRED, verificationUrl: PAGE })
        const assign = jest.fn()
        const original = window.location
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                ...original,
                set href(url: string) {
                    assign(url)
                },
            },
        })
        const { result } = renderHook(() => useEndorsementReview(), { wrapper })

        await act(() => result.current.start('BANK_TRANSFER_CO'))

        expect(assign).toHaveBeenCalledWith(PAGE)
        Object.defineProperty(window, 'location', { configurable: true, value: original })
    })

    it('re-reads the accounts when the user comes back from the page', async () => {
        claimDepositAccount.mockResolvedValue({ ...REQUIRED, verificationUrl: PAGE })
        const { result } = renderHook(() => useEndorsementReview(), { wrapper })
        await act(() => result.current.start('BANK_TRANSFER_CO'))
        ;(client.invalidateQueries as jest.Mock).mockClear()

        act(() => {
            document.dispatchEvent(new Event('visibilitychange'))
        })

        await waitFor(() => expect(client.invalidateQueries).toHaveBeenCalled())
    })

    it('stops re-reading once the returns are spent, instead of on every tab switch forever', async () => {
        claimDepositAccount.mockResolvedValue({ ...REQUIRED, verificationUrl: PAGE })
        const { result } = renderHook(() => useEndorsementReview(), { wrapper })
        await act(() => result.current.start('BANK_TRANSFER_CO'))
        ;(client.invalidateQueries as jest.Mock).mockClear()

        for (let i = 0; i < 8; i++) {
            act(() => {
                document.dispatchEvent(new Event('visibilitychange'))
            })
        }

        // the review either answered inside those returns or is not answering
        // during this visit; the list refetches on its own either way
        await waitFor(() => expect(client.invalidateQueries).toHaveBeenCalledTimes(5))
    })

    it('ignores a second tap while the first is in flight', async () => {
        let release: (value: unknown) => void = () => {}
        claimDepositAccount.mockReturnValue(new Promise((resolve) => (release = resolve)))
        const { result } = renderHook(() => useEndorsementReview(), { wrapper })

        let first: Promise<void>
        act(() => {
            first = result.current.start('BANK_TRANSFER_CO')
            void result.current.start('BANK_TRANSFER_CO')
        })
        await act(async () => {
            release({ ...REQUIRED, verificationUrl: PAGE })
            await first
        })

        expect(window.open).toHaveBeenCalledTimes(1)
        expect(claimDepositAccount).toHaveBeenCalledTimes(1)
    })
})

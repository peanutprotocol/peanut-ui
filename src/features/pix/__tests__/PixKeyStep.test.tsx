/** @jest-environment jsdom */
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { ApiError } from '@/services/api-error'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
const mockLookup = jest.fn()
jest.mock('@/services/pix', () => ({ pixApi: { lookupKey: (key: string) => mockLookup(key) } }))

import { PixKeyStep } from '../components/PixKeyStep'

/**
 * The key step on Bridge (API-CONTRACT.md section 6): the holder and bank Bridge validated, another
 * person's key a send where the flow pays one, and a defined line and next step for each refusal.
 */
const KEY = '11144477735'
const holder = { holderName: 'BRUNO LIMA', holderTaxIdMasked: null, bankName: 'Nu Pagamentos S.A.', ispb: null }

function renderStep(props: Partial<Parameters<typeof PixKeyStep>[0]> = {}) {
    const onContinue = jest.fn()
    const onRouteRefused = jest.fn()
    renderWithIntl(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <PixKeyStep
                title="Send"
                initialKey=""
                onBack={jest.fn()}
                onContinue={onContinue}
                onRouteRefused={onRouteRefused}
                {...props}
            />
        </QueryClientProvider>
    )
    fireEvent.change(screen.getByLabelText(en.withdraw.pixKey.placeholder), { target: { value: KEY } })
    return { onContinue, onRouteRefused }
}

describe('PixKeyStep on Bridge', () => {
    beforeEach(() => jest.clearAllMocks())

    it("lets another person's key continue where the flow pays it, by the name Bridge validated", async () => {
        mockLookup.mockResolvedValue({ ...holder, ownAccount: false, blocked: false })
        const { onContinue } = renderStep({ paysOthersKeys: true })

        expect(await screen.findByText('BRUNO LIMA')).toBeInTheDocument()
        expect(screen.getByText('Nu Pagamentos S.A.')).toBeInTheDocument()
        // the name says whom the money goes to: no warning badge
        expect(screen.queryByText(en.pix.withdraw.someoneElses)).toBeNull()
        await waitFor(() => expect(screen.getByRole('button', { name: en.common.continue })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: en.common.continue }))
        expect(onContinue).toHaveBeenCalledWith(KEY, expect.objectContaining({ holderName: 'BRUNO LIMA' }))
    })

    it("refuses another person's key where the flow pays the user's own only (a refused payout's new key)", async () => {
        mockLookup.mockResolvedValue({ ...holder, ownAccount: false, blocked: false })
        renderStep()

        expect(await screen.findByText(en.pix.withdraw.keyNotOwn)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.common.continue })).toBeDisabled()
    })

    it('marks the own key, and continues', async () => {
        mockLookup.mockResolvedValue({ ...holder, holderName: 'ANA SOUZA', ownAccount: true, blocked: false })
        renderStep({ paysOthersKeys: true })

        expect(await screen.findByText(en.pix.withdraw.ownAccount)).toBeInTheDocument()
        await waitFor(() => expect(screen.getByRole('button', { name: en.common.continue })).toBeEnabled())
    })

    it('offers Try again while Bridge still checks the key, names no holder, and finds it on the retry', async () => {
        jest.useFakeTimers()
        try {
            mockLookup.mockRejectedValue(new ApiError('checking', { status: 409, code: 'PIX_KEY_CHECK_PENDING' }))
            renderStep({ paysOthersKeys: true })
            // the input's debounce, then the lookup and its two retries, a step at a time
            for (let second = 0; second < 10; second++) await act(() => jest.advanceTimersByTimeAsync(1_000))
            expect(mockLookup).toHaveBeenCalledTimes(3)

            expect(screen.getByText(en.pix.withdraw.keyChecking)).toBeInTheDocument()
            expect(screen.queryByTestId('pix-key-holder')).toBeNull()
            expect(screen.queryByRole('button', { name: en.common.continue })).toBeNull()

            mockLookup.mockResolvedValue({ ...holder, ownAccount: false, blocked: false })
            fireEvent.click(screen.getByTestId('pix-key-retry'))
            await act(() => jest.advanceTimersByTimeAsync(1_000))
            expect(screen.getByTestId('pix-key-holder')).toHaveTextContent('BRUNO LIMA')
            expect(screen.queryByTestId('pix-key-retry')).toBeNull()
        } finally {
            jest.useRealTimers()
        }
    })

    it.each([
        [new ApiError('nf', { status: 404, code: 'PIX_KEY_NOT_FOUND' }), en.withdraw.pixKey.notFound, false],
        [new ApiError('nf', { status: 422, code: 'PIX_KEY_NOT_FOUND' }), en.withdraw.pixKey.notFound, false],
        [
            new ApiError('bounced', { status: 409, code: 'BANK_ACCOUNT_NOT_USABLE' }),
            en.pix.withdraw.keyNotUsable,
            false,
        ],
        [new ApiError('down', { status: 502, code: 'PROVIDER_UNAVAILABLE' }), en.pix.withdraw.lookupFailed, true],
        [new ApiError('closed', { status: 403, code: 'ROUTE_NOT_AVAILABLE' }), en.pix.rolloutClosed, false],
    ])('says what a refused lookup means and offers its next step (%#)', async (error, line, retry) => {
        mockLookup.mockRejectedValue(error)
        const { onRouteRefused } = renderStep({ paysOthersKeys: true })

        expect(await screen.findByText(line)).toBeInTheDocument()
        expect(!!screen.queryByTestId('pix-key-retry')).toBe(retry)
        expect(onRouteRefused).toHaveBeenCalledTimes(line === en.pix.rolloutClosed ? 1 : 0)
    })
})

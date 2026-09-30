import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { captureException } from '@sentry/nextjs'
import { ReceiptTokenRows } from '@/components/TransactionDetails/ReceiptTokenRows'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/i18n/app/useAppTranslations', () => ({
    useAppTranslations: () => (key: string, values?: Record<string, string>) =>
        values ? `${key}:${values.token}@${values.chain}` : key,
}))

const TOKEN = '0x1111111111111111111111111111111111111111'
const fetchMock = jest.fn()

function renderRows(details: TransactionDetails['tokenDisplayDetails']) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const transaction = {
        tokenAddress: TOKEN,
        tokenSymbol: 'WEIRD',
        tokenDisplayDetails: details,
    } as TransactionDetails
    return render(
        <QueryClientProvider client={client}>
            <ReceiptTokenRows transaction={transaction} isPeanutWalletToken={false} />
        </QueryClientProvider>
    )
}

beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = fetchMock
})

describe('ReceiptTokenRows token lookup', () => {
    it('keeps the known symbol and network when the lookup 404s, without error capture', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
        renderRows({ tokenSymbol: 'weird', chainId: '10', chainName: 'OP Mainnet' })

        expect(await screen.findByText('rows.tokenOnChain:WEIRD@OP Mainnet')).toBeInTheDocument()
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        // canonical platform id, not a slug of 'OP Mainnet'
        expect(fetchMock.mock.calls[0][0]).toBe(
            `https://api.coingecko.com/api/v3/coins/optimistic-ethereum/contract/${TOKEN}`
        )
        expect(captureException).not.toHaveBeenCalled()
    })

    it('keeps the row and reports an unexpected failure', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' })
        renderRows({ tokenSymbol: 'weird', chainId: '42161', chainName: 'Arbitrum One' })

        expect(await screen.findByText('rows.tokenOnChain:WEIRD@Arbitrum One')).toBeInTheDocument()
        await waitFor(() => expect(captureException).toHaveBeenCalledTimes(1))
    })

    it('reports a malformed payload', async () => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ symbol: 'abc' }) })
        renderRows({ tokenSymbol: 'weird', chainId: '42161', chainName: 'Arbitrum One' })

        expect(await screen.findByText('rows.tokenOnChain:WEIRD@Arbitrum One')).toBeInTheDocument()
        await waitFor(() => expect(captureException).toHaveBeenCalledTimes(1))
    })

    it.each([
        ['a network error', () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))],
        ['a rate limit', () => fetchMock.mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many' })],
    ])('keeps the row without reporting %s', async (_, arrange) => {
        arrange()
        renderRows({ tokenSymbol: 'weird', chainId: '42161', chainName: 'Arbitrum One' })

        expect(await screen.findByText('rows.tokenOnChain:WEIRD@Arbitrum One')).toBeInTheDocument()
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        expect(captureException).not.toHaveBeenCalled()
    })

    it('shows the CoinGecko icon when the wire icon is an empty string', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ symbol: 'weird', image: { large: 'https://example.com/weird.png' } }),
        })
        renderRows({ tokenSymbol: 'weird', tokenIconUrl: '', chainId: '42161', chainName: 'Arbitrum One' })

        expect(await screen.findByAltText('weird')).toBeInTheDocument()
    })

    it('skips the lookup for a chain CoinGecko does not list', async () => {
        renderRows({ tokenSymbol: 'weird', chainId: '4217', chainName: 'Tempo' })

        expect(await screen.findByText('rows.tokenOnChain:WEIRD@Tempo')).toBeInTheDocument()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('falls back to the chain name when the chain id is not in the registry (Solana "0")', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
        renderRows({ tokenSymbol: 'weird', chainId: '0', chainName: 'Solana' })

        expect(await screen.findByText('rows.tokenOnChain:WEIRD@Solana')).toBeInTheDocument()
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        expect(fetchMock.mock.calls[0][0]).toBe(`https://api.coingecko.com/api/v3/coins/solana/contract/${TOKEN}`)
    })

    it('uses the looked-up symbol when the wire has none', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ symbol: 'abc', image: { large: 'https://example.com/abc.png' } }),
        })
        renderRows({ chainId: '8453', chainName: 'Base' })

        expect(await screen.findByText('rows.tokenOnChain:ABC@Base')).toBeInTheDocument()
    })

    it('renders nothing when neither the wire nor the lookup knows the symbol', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
        const { container } = renderRows({ chainId: '8453', chainName: 'Base' })

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        expect(container).toBeEmptyDOMElement()
    })

    it('uses the wire symbol and icon without a lookup', async () => {
        renderRows({
            tokenSymbol: 'usdc',
            tokenIconUrl: 'https://example.com/usdc.png',
            chainId: '42161',
            chainName: 'Arbitrum One',
        })

        expect(await screen.findByText('rows.tokenOnChain:USDC@Arbitrum One')).toBeInTheDocument()
        expect(screen.getByAltText('usdc')).toBeInTheDocument()
        expect(fetchMock).not.toHaveBeenCalled()
    })
})

/**
 * The shared receipt page renders on the server, and the server render is
 * anonymous: `serverFetch` reads the session from js-cookie, which does not
 * exist in a server component. That is correct for the document everyone else
 * reads, and wrong for the one person who owns it — the API aliases a retired
 * crypto-link deposit onto the canonical virtual-account receipt for the owner
 * alone, so the owner was shown the public projection of their own deposit.
 *
 * These pin both halves: the page still asks the API anonymously (the answer
 * is shared with the PDF route's public cache), and the browser asks a second
 * time with the owner's token.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'

jest.mock('@/app/actions/history', () => ({ getHistoryEntry: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn(), serverFetch: jest.fn() }))
jest.mock('@/utils/auth-token', () => ({ getAuthToken: jest.fn() }))
jest.mock('@/utils/history.utils', () => ({
    ...jest.requireActual('@/utils/history.utils'),
    completeHistoryEntry: jest.fn(async (entry: unknown) => entry),
}))
jest.mock('@/components/TransactionDetails/transactionTransformer', () => ({
    mapTransactionDataForDrawer: jest.fn(),
}))
jest.mock('@/components/TransactionDetails/TransactionDetailsReceipt', () => ({
    TransactionDetailsReceipt: ({ transaction }: { transaction: TransactionDetails }) => (
        <div data-testid="receipt">{transaction.id}</div>
    ),
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/PageContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('next/server', () => ({ connection: jest.fn() }))
jest.mock('next/navigation', () => ({ notFound: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

import { getHistoryEntry } from '@/app/actions/history'
import { apiFetch } from '@/utils/api-fetch'
import { getAuthToken } from '@/utils/auth-token'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { OwnerReceiptView } from '../OwnerReceiptView'
import ReceiptPage from '../page'

const mockGetHistoryEntry = getHistoryEntry as jest.MockedFunction<typeof getHistoryEntry>
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>
const mockGetAuthToken = getAuthToken as jest.MockedFunction<typeof getAuthToken>
const mockMap = mapTransactionDataForDrawer as jest.MockedFunction<typeof mapTransactionDataForDrawer>

const ENTRY_ID = 'b27d2f1a-0000-4000-8000-000000000001'
/** the retired crypto-link entry every non-owner reads */
const PUBLIC_ENTRY = { uuid: ENTRY_ID, status: 'CANCELED' }
/** the canonical virtual-account receipt the API aliases to for the owner */
const OWNER_ENTRY = { uuid: 'va-onramp-1', status: 'COMPLETED' }

const details = (id: string) => ({ id }) as TransactionDetails

const renderClient = (ui: React.ReactElement) =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            {ui}
        </QueryClientProvider>
    )

beforeEach(() => {
    jest.clearAllMocks()
    mockMap.mockImplementation(
        (entry: unknown) =>
            ({
                transactionDetails: details((entry as { uuid: string }).uuid),
            }) as ReturnType<typeof mapTransactionDataForDrawer>
    )
})

describe('the shared receipt page', () => {
    it('asks the API anonymously, so the PDF route keeps caching one public body', async () => {
        mockGetHistoryEntry.mockResolvedValue(PUBLIC_ENTRY as never)

        const ui = await ReceiptPage({
            params: Promise.resolve({ entryId: ENTRY_ID }),
            searchParams: Promise.resolve({ kind: 'CRYPTO_DEPOSIT' }),
        })
        mockGetAuthToken.mockReturnValue(null)
        renderClient(ui as React.ReactElement)

        // the shared read takes the id and the kind and nothing else — no
        // cookie, no bearer token, nothing that could vary the cached body
        expect(mockGetHistoryEntry).toHaveBeenCalledWith(ENTRY_ID, 'CRYPTO_DEPOSIT')
        expect(await screen.findByTestId('receipt')).toHaveTextContent(ENTRY_ID)
    })
})

describe('the owner read from the browser', () => {
    const ownerResponse = () =>
        ({ ok: true, status: 200, json: jest.fn().mockResolvedValue(OWNER_ENTRY) }) as unknown as Response

    it('an owner sees the virtual-account receipt the API aliases to', async () => {
        mockGetAuthToken.mockReturnValue('a-session')
        mockApiFetch.mockResolvedValue(ownerResponse())

        renderClient(<OwnerReceiptView entryId={ENTRY_ID} kind="CRYPTO_DEPOSIT" serverDetails={details(ENTRY_ID)} />)

        await waitFor(() => expect(screen.getByTestId('receipt')).toHaveTextContent('va-onramp-1'))
        expect(mockApiFetch).toHaveBeenCalledTimes(1)
        expect(mockApiFetch).toHaveBeenCalledWith(`/history/${ENTRY_ID}?kind=CRYPTO_DEPOSIT`)
        // never the shared server action: its answer feeds a public cache
        expect(mockGetHistoryEntry).not.toHaveBeenCalled()
    })

    it('an anonymous holder of the old link keeps the public view', async () => {
        mockGetAuthToken.mockReturnValue(null)

        renderClient(<OwnerReceiptView entryId={ENTRY_ID} kind="CRYPTO_DEPOSIT" serverDetails={details(ENTRY_ID)} />)

        await waitFor(() => expect(screen.getByTestId('receipt')).toHaveTextContent(ENTRY_ID))
        expect(mockApiFetch).not.toHaveBeenCalled()
    })

    it('spends no request on a kind the owner alias cannot apply to', async () => {
        mockGetAuthToken.mockReturnValue('a-session')

        renderClient(<OwnerReceiptView entryId={ENTRY_ID} kind="OFFRAMP" serverDetails={details(ENTRY_ID)} />)

        await waitFor(() => expect(screen.getByTestId('receipt')).toHaveTextContent(ENTRY_ID))
        expect(mockApiFetch).not.toHaveBeenCalled()
    })

    it('leaves the server projection on screen when the owner read fails', async () => {
        mockGetAuthToken.mockReturnValue('a-session')
        mockApiFetch.mockResolvedValue({ ok: false, status: 503 } as unknown as Response)

        renderClient(<OwnerReceiptView entryId={ENTRY_ID} kind="CRYPTO_DEPOSIT" serverDetails={details(ENTRY_ID)} />)

        await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
        expect(screen.getByTestId('receipt')).toHaveTextContent(ENTRY_ID)
    })
})

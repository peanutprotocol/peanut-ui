import React from 'react'
import { act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { TRANSACTIONS } from '@/constants/query.consts'
import { apiFetch } from '@/utils/api-fetch'
import { OwnerReceiptView } from '../OwnerReceiptView'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
let mockUserId: string | undefined
const mockReceiptIds: string[] = []
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ userId: mockUserId }) }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))
jest.mock('@/utils/history.utils', () => ({ completeHistoryEntry: jest.fn(async (entry: unknown) => entry) }))
jest.mock('@/components/TransactionDetails/transactionTransformer', () => ({ mapTransactionDataForDrawer: jest.fn() }))
jest.mock('@/components/TransactionDetails/TransactionDetailsReceipt', () => ({
    TransactionDetailsReceipt: ({ transaction }: { transaction: TransactionDetails }) => {
        mockReceiptIds.push(transaction.id)
        return <h1 data-testid="receipt-header">{transaction.id}</h1>
    },
}))

const ENTRY_ID = 'b27d2f1a-0000-4000-8000-000000000001'
const SERVER_DETAILS = { id: ENTRY_ID } as TransactionDetails
const OWNER_DETAILS = { id: 'va-onramp-1' } as TransactionDetails
const ownerKey = (userId: string | undefined, kind = 'CRYPTO_DEPOSIT') => [
    TRANSACTIONS,
    'entry',
    ENTRY_ID,
    kind,
    'owner',
    userId,
]
const clients: QueryClient[] = []
let root: Root | undefined
let container: HTMLDivElement

function newClient() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    clients.push(client)
    return client
}

function Tree({ client, kind = 'CRYPTO_DEPOSIT' }: { client: QueryClient; kind?: 'CRYPTO_DEPOSIT' | 'OFFRAMP' }) {
    return (
        <QueryClientProvider client={client}>
            <OwnerReceiptView entryId={ENTRY_ID} kind={kind} serverDetails={SERVER_DETAILS} />
        </QueryClientProvider>
    )
}

beforeEach(() => {
    jest.clearAllMocks()
    mockUserId = undefined
    mockReceiptIds.length = 0
    container = document.createElement('div')
    document.body.appendChild(container)
})

afterEach(() => {
    if (root) act(() => root!.unmount())
    root = undefined
    container.remove()
    clients.forEach((client) => client.clear())
    clients.length = 0
})

describe('owner receipt cached-query hydration', () => {
    it('hydrates public server HTML with an authenticated owner cache, then updates the same header', async () => {
        const serverClient = newClient()
        container.innerHTML = renderToString(<Tree client={serverClient} />)
        expect(mockReceiptIds).toEqual([ENTRY_ID])
        const header = container.querySelector('[data-testid="receipt-header"]')
        expect(header).toHaveTextContent(ENTRY_ID)

        const client = newClient()
        client.setQueryData(ownerKey('owner-a'), OWNER_DETAILS)
        mockUserId = 'owner-a'
        mockReceiptIds.length = 0
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Tree client={client} />, { onRecoverableError })
        })

        expect(mockReceiptIds[0]).toBe(ENTRY_ID)
        expect(onRecoverableError).not.toHaveBeenCalled()
        expect(container.querySelector('[data-testid="receipt-header"]')).toBe(header)
        expect(header).toHaveTextContent(OWNER_DETAILS.id)
        expect(apiFetch).not.toHaveBeenCalled()

        client.setQueryData(ownerKey(undefined), OWNER_DETAILS)
        mockUserId = undefined
        mockReceiptIds.length = 0
        await act(async () => root!.render(<Tree client={client} />))
        expect(header).toHaveTextContent(ENTRY_ID)
        expect(mockReceiptIds).not.toContain(OWNER_DETAILS.id)
        expect(container.querySelector('[data-testid="receipt-header"]')).toBe(header)
        expect(apiFetch).not.toHaveBeenCalled()
    })

    it('always uses the server projection in SSR, including with a warm authenticated query cache', () => {
        const client = newClient()
        client.setQueryData(ownerKey('owner-a'), OWNER_DETAILS)
        mockUserId = 'owner-a'
        const html = renderToString(<Tree client={client} />)
        expect(mockReceiptIds).toEqual([ENTRY_ID])
        expect(html).toContain(ENTRY_ID)
        expect(html).not.toContain(OWNER_DETAILS.id)
        expect(apiFetch).not.toHaveBeenCalled()
    })

    it.each([
        [undefined, 'CRYPTO_DEPOSIT'],
        ['owner-a', 'OFFRAMP'],
    ] as const)(
        'does not render a private cached projection when query is disabled for %s / %s',
        async (userId, kind) => {
            container.innerHTML = renderToString(<Tree client={newClient()} kind={kind} />)
            const header = container.querySelector('[data-testid="receipt-header"]')
            const client = newClient()
            client.setQueryData(ownerKey(userId, kind), OWNER_DETAILS)
            mockUserId = userId
            mockReceiptIds.length = 0
            const onRecoverableError = jest.fn()
            await act(async () => {
                root = hydrateRoot(container, <Tree client={client} kind={kind} />, { onRecoverableError })
            })
            expect(mockReceiptIds).not.toContain(OWNER_DETAILS.id)
            expect(header).toHaveTextContent(ENTRY_ID)
            expect(container.querySelector('[data-testid="receipt-header"]')).toBe(header)
            expect(onRecoverableError).not.toHaveBeenCalled()
            expect(apiFetch).not.toHaveBeenCalled()
        }
    )
})

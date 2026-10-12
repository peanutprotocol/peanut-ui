import React from 'react'
import { render, screen } from '@testing-library/react'

// badge and kyc rows must only appear once history has loaded through their
// timestamp, otherwise they sit at the bottom of page 1 and jump when older
// pages arrive

type Page = { entries: Array<{ uuid: string; timestamp: string; type: string }>; cursor?: string; hasMore?: boolean }

let mockPages: Page[] = []
let mockHasNextPage = false
let mockIsFetchingNextPage = false
let mockUser: unknown = null
const mockLoaderRef = { current: null as HTMLDivElement | null }
// stable data per pages array, like the query cache, so memo deps are exercised
const mockDataByPages = new WeakMap<Page[], { pages: Page[]; pageParams: unknown[] }>()

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
    useFormatter: () => ({ dateTime: () => 'date' }),
}))
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ setQueryData: jest.fn(), invalidateQueries: jest.fn() }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser, fetchUser: jest.fn() }),
}))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: jest.fn() }))
jest.mock('@/hooks/useInfiniteScroll', () => ({ useInfiniteScroll: () => ({ loaderRef: mockLoaderRef }) }))
jest.mock('@/hooks/useTransactionDetailsDrawer', () => ({
    useTransactionDetailsDrawer: () => ({
        isTransactionSelected: () => false,
        openTransactionDetails: jest.fn(),
        closeTransactionDetails: jest.fn(),
    }),
}))
jest.mock('@/hooks/useTransactionHistory', () => ({
    useTransactionHistory: () => ({
        data:
            mockDataByPages.get(mockPages) ??
            mockDataByPages.set(mockPages, { pages: mockPages, pageParams: [] }).get(mockPages),
        hasNextPage: mockHasNextPage,
        fetchNextPage: jest.fn(),
        isFetchingNextPage: mockIsFetchingNextPage,
        isLoading: false,
        isError: false,
        error: null,
    }),
}))
jest.mock('@/utils/general.utils', () => ({ getUserPreferences: () => undefined }))
jest.mock('@/utils/history.utils', () => ({
    completeHistoryEntry: jest.fn(),
    dedupeHistoryEntriesByUuid: (entries: Array<{ uuid: string }>) => {
        const byUuid = new Map(entries.map((e) => [e.uuid, e]))
        return entries.filter((e) => byUuid.get(e.uuid) === e)
    },
}))
jest.mock('@/components/Kyc/KycStatusItem', () => ({
    KycStatusItem: () => <div data-testid="row">kyc</div>,
    isKycStatusItem: (entry: object) => 'isKyc' in entry && (entry as { isKyc?: unknown }).isKyc === true,
}))
jest.mock('@/components/Badges/BadgeStatusItem', () => ({
    BadgeStatusItem: ({ entry }: { entry: { code: string } }) => <div data-testid="row">{`badge:${entry.code}`}</div>,
}))
jest.mock('@/components/Global/NavHeader', () => () => null)
jest.mock('@/components/Global/Loading', () => () => null)
jest.mock('@/components/Global/EmptyStates/EmptyState', () => () => null)
jest.mock('@/components/Global/EmptyStates/NoDataEmptyState', () => {
    function MockNoDataEmptyState() {
        return <div data-testid="empty" />
    }
    return MockNoDataEmptyState
})
jest.mock('@/components/TransactionDetails/transactionTransformer', () => ({
    mapTransactionDataForDrawer: (item: { uuid: string }) => ({
        transactionCardType: 'send',
        transactionDetails: { id: item.uuid, userName: 'bob', amount: '1', status: 'completed', initials: 'B' },
    }),
}))
jest.mock('@/components/TransactionDetails/TransactionCard', () => {
    function MockTransactionCard({ transaction }: { transaction: { id: string } }) {
        return <div data-testid="row">{transaction.id}</div>
    }
    return MockTransactionCard
})

import HistoryPage from '../page'

const RECENT = new Date(Date.now() - 60_000).toISOString()

const tx = (uuid: string, timestamp: string) => ({ uuid, timestamp, type: 'SEND' })
const cursorAt = (timestamp: string, uuid: string) => `${timestamp}::${uuid}`

function setUser({ badges = [], kycAt }: { badges?: Array<{ code: string; earnedAt: string }>; kycAt?: string }) {
    mockUser = {
        user: {
            userId: 'user-1',
            username: 'alice',
            createdAt: '2023-01-01T00:00:00.000Z',
            badges: badges.map((b) => ({ id: b.code, name: b.code, ...b })),
        },
        accounts: [],
        identityVerification: kycAt ? { status: 'approved', reviewedAt: kycAt } : undefined,
    }
}

const rows = () => screen.queryAllByTestId('row').map((el) => el.textContent)

// full history, newest first:
// recent badge, tx-1, tx-2, | og badge, tx-3, tx-4, | kyc, tx-5
const page1: Page = {
    entries: [tx('tx-1', '2024-03-10T00:00:00.000Z'), tx('tx-2', '2024-03-01T00:00:00.000Z')],
    cursor: cursorAt('2024-03-01T00:00:00.000Z', 'tx-2'),
    hasMore: true,
}
const page2: Page = {
    entries: [tx('tx-3', '2024-02-15T00:00:00.000Z'), tx('tx-4', '2024-02-01T00:00:00.000Z')],
    cursor: cursorAt('2024-02-01T00:00:00.000Z', 'tx-4'),
    hasMore: true,
}
const page3: Page = { entries: [tx('tx-5', '2024-01-01T00:00:00.000Z')], hasMore: false }

describe('HistoryPage badge and kyc rows during pagination', () => {
    beforeEach(() => {
        mockPages = []
        mockHasNextPage = false
        mockIsFetchingNextPage = false
        setUser({
            badges: [
                { code: 'RECENT', earnedAt: RECENT },
                { code: 'OG', earnedAt: '2024-02-20T00:00:00.000Z' },
            ],
            kycAt: '2024-01-15T00:00:00.000Z',
        })
    })

    it('holds old rows back until the pages around them load, then places them between transactions', () => {
        mockPages = [page1]
        mockHasNextPage = true
        const { rerender } = render(<HistoryPage />)
        expect(rows()).toEqual(['badge:RECENT', 'tx-1', 'tx-2'])

        mockIsFetchingNextPage = true
        rerender(<HistoryPage />)
        expect(rows()).toEqual(['badge:RECENT', 'tx-1', 'tx-2'])
        expect(screen.getByText('loadingMore')).toBeInTheDocument()

        mockIsFetchingNextPage = false
        mockPages = [page1, page2]
        rerender(<HistoryPage />)
        expect(rows()).toEqual(['badge:RECENT', 'tx-1', 'tx-2', 'badge:OG', 'tx-3', 'tx-4'])

        mockPages = [page1, page2, page3]
        mockHasNextPage = false
        rerender(<HistoryPage />)
        expect(rows()).toEqual(['badge:RECENT', 'tx-1', 'tx-2', 'badge:OG', 'tx-3', 'tx-4', 'kyc', 'tx-5'])
    })

    it('holds a row stamped exactly at the cursor until history moves past that timestamp', () => {
        setUser({ badges: [{ code: 'TIE', earnedAt: '2024-03-01T00:00:00.000Z' }] })
        mockPages = [page1]
        mockHasNextPage = true
        const { rerender } = render(<HistoryPage />)
        expect(rows()).toEqual(['tx-1', 'tx-2'])

        // another row at the same timestamp arrives on the next page
        mockPages = [
            page1,
            {
                entries: [tx('tx-2b', '2024-03-01T00:00:00.000Z'), tx('tx-3', '2024-02-15T00:00:00.000Z')],
                cursor: cursorAt('2024-02-15T00:00:00.000Z', 'tx-3'),
                hasMore: true,
            },
        ]
        rerender(<HistoryPage />)
        expect(rows()).toEqual(['tx-1', 'tx-2', 'tx-2b', 'badge:TIE', 'tx-3'])
    })

    it('uses the cursor, not the oldest visible transaction, as the boundary', () => {
        // another source contributed an old row that sits below the cursor
        mockPages = [
            { ...page1, entries: [tx('tx-1', '2024-03-10T00:00:00.000Z'), tx('tx-old', '2024-01-01T00:00:00.000Z')] },
        ]
        mockHasNextPage = true
        render(<HistoryPage />)
        expect(rows()).toEqual(['badge:RECENT', 'tx-1', 'tx-old'])
    })

    it('advances the boundary on an empty page whose cursor moved', () => {
        mockPages = [page1, { entries: [], cursor: cursorAt('2024-02-10T00:00:00.000Z', 'x'), hasMore: true }]
        mockHasNextPage = true
        render(<HistoryPage />)
        expect(rows()).toEqual(['badge:RECENT', 'tx-1', 'tx-2', 'badge:OG'])
    })

    it('keeps paginating instead of showing the empty state when page 1 is empty but has more', () => {
        mockPages = [{ entries: [], cursor: cursorAt('2024-03-05T00:00:00.000Z', 'x'), hasMore: true }]
        mockHasNextPage = true
        setUser({ badges: [{ code: 'OG', earnedAt: '2024-02-20T00:00:00.000Z' }] })
        render(<HistoryPage />)
        expect(rows()).toEqual([])
        expect(screen.queryByTestId('empty')).toBeNull()
        expect(mockLoaderRef.current).toBeInTheDocument()
    })

    it('shows every row once the api confirms there is no more history', () => {
        mockPages = [{ entries: [], hasMore: false }]
        render(<HistoryPage />)
        expect(rows()).toEqual(['badge:RECENT', 'badge:OG', 'kyc'])
        expect(screen.queryByTestId('empty')).toBeNull()
    })

    it('shows old rows in date order when pagination stalls while the api still reports more', () => {
        // the hook stops on an unchanged cursor, so no further page can arrive
        mockPages = [page1, { entries: [], cursor: page1.cursor, hasMore: true }]
        mockHasNextPage = false
        render(<HistoryPage />)
        expect(rows()).toEqual(['badge:RECENT', 'tx-1', 'tx-2', 'badge:OG', 'kyc'])
    })

    it('falls back to the last usable cursor when the latest one is invalid', () => {
        mockPages = [page1, { ...page2, cursor: 'not-a-date::tx-4' }]
        mockHasNextPage = true
        render(<HistoryPage />)
        expect(rows()).toEqual(['badge:RECENT', 'tx-1', 'tx-2', 'tx-3', 'tx-4'])
    })

    it('hides badge and kyc rows without a usable cursor until no further page can load', () => {
        mockPages = [{ ...page1, cursor: 'not-a-date::tx-2' }]
        mockHasNextPage = true
        const { rerender } = render(<HistoryPage />)
        expect(rows()).toEqual(['tx-1', 'tx-2'])

        // same cached pages, but the hook has stopped paginating
        mockHasNextPage = false
        rerender(<HistoryPage />)
        expect(rows()).toEqual(['badge:RECENT', 'tx-1', 'tx-2', 'badge:OG', 'kyc'])
    })
})

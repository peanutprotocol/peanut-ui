import React from 'react'
import { render } from '@testing-library/react'

const mockTransactionCard = jest.fn()

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
    useFormatter: () => ({ dateTime: () => 'date' }),
}))
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ setQueryData: jest.fn(), invalidateQueries: jest.fn() }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'user-1', username: 'alice', badges: [] }, accounts: [] },
        fetchUser: jest.fn(),
    }),
}))
jest.mock('@/hooks/useCardInfo', () => ({ useCardInfo: () => ({ cardInfo: undefined }) }))
jest.mock('@/hooks/useRainCardOverview', () => ({ useRainCardOverview: () => ({ overview: undefined }) }))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: jest.fn() }))
jest.mock('@/hooks/useInfiniteScroll', () => ({ useInfiniteScroll: () => ({ loaderRef: { current: null } }) }))
jest.mock('@/hooks/useTransactionDetailsDrawer', () => ({
    useTransactionDetailsDrawer: () => ({
        selectedTxId: null,
        isTransactionSelected: () => false,
        openTransactionDetails: jest.fn(),
        closeTransactionDetails: jest.fn(),
    }),
}))

// two date groups: two entries today, two on one fixed past day
const nowMs = Date.now()
const mockEntries = [
    { uuid: 'tx-1', timestamp: new Date(nowMs - 1000).toISOString(), type: 'SEND' },
    { uuid: 'tx-2', timestamp: new Date(nowMs - 2000).toISOString(), type: 'SEND' },
    { uuid: 'tx-3', timestamp: '2024-01-05T12:01:00Z', type: 'SEND' },
    { uuid: 'tx-4', timestamp: '2024-01-05T12:00:00Z', type: 'SEND' },
]
jest.mock('@/hooks/useTransactionHistory', () => ({
    useTransactionHistory: () => ({
        data: { pages: [{ entries: mockEntries }] },
        hasNextPage: false,
        fetchNextPage: jest.fn(),
        isFetchingNextPage: false,
        isLoading: false,
        isError: false,
        error: null,
    }),
}))
jest.mock('@/utils/general.utils', () => ({ getUserPreferences: () => undefined }))
jest.mock('@/utils/kyc-grouping.utils', () => ({ buildKycHistoryEntry: () => null }))
jest.mock('@/utils/history.utils', () => ({
    completeHistoryEntry: jest.fn(),
    dedupeHistoryEntriesByUuid: (entries: unknown[]) => entries,
}))
jest.mock('@/components/Kyc/KycStatusItem', () => ({ KycStatusItem: () => null, isKycStatusItem: () => false }))
jest.mock('@/components/Badges/BadgeStatusItem', () => ({ BadgeStatusItem: () => null }))
jest.mock('@/components/Badges/badge.types', () => ({ isBadgeHistoryItem: () => false }))
jest.mock('@/components/Global/NavHeader', () => () => null)
jest.mock('@/components/Global/Loading', () => () => null)
jest.mock('@/components/Global/EmptyStates/EmptyState', () => () => null)
jest.mock('@/components/Global/EmptyStates/NoDataEmptyState', () => () => null)
jest.mock('@/components/TransactionDetails/transactionTransformer', () => ({
    mapTransactionDataForDrawer: () => ({
        transactionCardType: 'send',
        transactionDetails: { id: 'tx-1', userName: 'bob', amount: '12.5', status: 'completed', initials: 'B' },
    }),
}))
jest.mock('@/components/TransactionDetails/TransactionCard', () => {
    function MockTransactionCard(props: { position?: string }) {
        mockTransactionCard(props)
        return <div data-testid="txn-card" />
    }
    return MockTransactionCard
})

import HistoryPage from '../page'

describe('HistoryPage card corners per date group', () => {
    beforeEach(() => {
        mockTransactionCard.mockClear()
    })

    it('closes each group with last and reopens the next with first at the boundary', () => {
        render(<HistoryPage />)
        const positions = mockTransactionCard.mock.calls.map(([props]) => props.position)
        expect(positions).toEqual(['first', 'last', 'first', 'last'])
    })
})

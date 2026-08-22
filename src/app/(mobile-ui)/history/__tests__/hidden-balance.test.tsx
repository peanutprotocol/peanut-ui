import React from 'react'
import { render, screen } from '@testing-library/react'

const mockGetUserPreferences = jest.fn()
const mockTransactionCard = jest.fn()

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
    useFormatter: () => ({ dateTime: () => 'date' }),
}))
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ setQueryData: jest.fn(), invalidateQueries: jest.fn() }),
}))
jest.mock('@/redux/hooks', () => ({
    useUserStore: () => ({ user: { user: { userId: 'user-1', username: 'alice', badges: [] }, accounts: [] } }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: jest.fn() }) }))
jest.mock('@/hooks/useCardInfo', () => ({ useCardInfo: () => ({ cardInfo: undefined }) }))
jest.mock('@/hooks/useRainCardOverview', () => ({ useRainCardOverview: () => ({ overview: undefined }) }))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: jest.fn() }))
jest.mock('@/hooks/useInfiniteScroll', () => ({ useInfiniteScroll: () => ({ loaderRef: { current: null } }) }))
jest.mock('@/hooks/useTransactionHistory', () => ({
    useTransactionHistory: () => ({
        data: { pages: [{ entries: [{ uuid: 'tx-1', timestamp: '2026-01-01T00:00:00Z', type: 'SEND' }] }] },
        hasNextPage: false,
        fetchNextPage: jest.fn(),
        isFetchingNextPage: false,
        isLoading: false,
        isError: false,
        error: null,
    }),
}))
jest.mock('@/utils/general.utils', () => ({ getUserPreferences: (id: string) => mockGetUserPreferences(id) }))
jest.mock('@/utils/kyc-grouping.utils', () => ({ buildKycHistoryEntry: () => null }))
jest.mock('@/utils/history.utils', () => ({
    completeHistoryEntry: jest.fn(),
    dedupeHistoryEntriesByUuid: (entries: unknown[]) => entries,
}))
jest.mock('@/components/Kyc/KycStatusItem', () => ({ KycStatusItem: () => null, isKycStatusItem: () => false }))
jest.mock('@/components/Badges/BadgeStatusItem', () => ({ BadgeStatusItem: () => null }))
jest.mock('@/components/Badges/badge.types', () => ({ isBadgeHistoryItem: () => false }))
jest.mock('@/components/Card/CardUnlockHistoryItem', () => () => null)
jest.mock('@/components/Card/cardUnlock.types', () => ({
    deriveCardUnlockEntry: () => null,
    isCardUnlockHistoryItem: () => false,
}))
jest.mock('@/components/Global/NavHeader', () => () => null)
jest.mock('@/components/Global/PeanutLoading', () => () => null)
jest.mock('@/components/Global/EmptyStates/EmptyState', () => () => null)
jest.mock('@/components/Global/EmptyStates/NoDataEmptyState', () => () => null)
jest.mock('@/components/TransactionDetails/transactionTransformer', () => ({
    mapTransactionDataForDrawer: () => ({
        transactionCardType: 'send',
        transactionDetails: { userName: 'bob', amount: '12.5', status: 'completed', initials: 'B' },
    }),
}))
jest.mock('@/components/TransactionDetails/TransactionCard', () => {
    function MockTransactionCard(props: { hideTxnAmount?: boolean }) {
        mockTransactionCard(props)
        return <div data-testid="txn-card">{props.hideTxnAmount ? '****' : 'amount'}</div>
    }
    return MockTransactionCard
})

import HistoryPage from '../page'

describe('HistoryPage hidden-balance preference', () => {
    beforeEach(() => {
        mockGetUserPreferences.mockReset()
        mockTransactionCard.mockClear()
    })

    it('masks transaction amounts when balanceHidden is set', () => {
        mockGetUserPreferences.mockReturnValue({ balanceHidden: true })
        render(<HistoryPage />)
        expect(mockGetUserPreferences).toHaveBeenCalledWith('user-1')
        expect(mockTransactionCard).toHaveBeenCalledWith(expect.objectContaining({ hideTxnAmount: true }))
        expect(screen.getByTestId('txn-card')).toHaveTextContent('****')
    })

    it('shows transaction amounts when the preference is unset', () => {
        mockGetUserPreferences.mockReturnValue(undefined)
        render(<HistoryPage />)
        expect(mockTransactionCard).toHaveBeenCalledWith(expect.objectContaining({ hideTxnAmount: false }))
        expect(screen.getByTestId('txn-card')).toHaveTextContent('amount')
    })
})

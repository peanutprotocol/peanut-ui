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
// selection is hoisted to the list — the page computes isSelected per row from
// this hook (rows no longer subscribe to `?tx=` themselves)
let mockSelectedTxId: string | null = null
jest.mock('@/hooks/useTransactionDetailsDrawer', () => ({
    useTransactionDetailsDrawer: () => ({
        selectedTxId: mockSelectedTxId,
        isTransactionSelected: (id?: string | null) => mockSelectedTxId != null && mockSelectedTxId === id,
        openTransactionDetails: jest.fn(),
        closeTransactionDetails: jest.fn(),
    }),
}))
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
        mockSelectedTxId = null
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

    // deep-link wiring: `?tx=` (via the hoisted hook) still selects the right
    // row after the per-row subscription moved to the list level
    it('marks the row matching the url tx id as selected', () => {
        mockGetUserPreferences.mockReturnValue(undefined)
        mockSelectedTxId = 'tx-1'
        render(<HistoryPage />)
        expect(mockTransactionCard).toHaveBeenCalledWith(
            expect.objectContaining({
                isSelected: true,
                onOpen: expect.any(Function),
                onClose: expect.any(Function),
            })
        )
    })

    it('passes isSelected=false when no tx id is in the url', () => {
        mockGetUserPreferences.mockReturnValue(undefined)
        render(<HistoryPage />)
        expect(mockTransactionCard).toHaveBeenCalledWith(expect.objectContaining({ isSelected: false }))
    })
})

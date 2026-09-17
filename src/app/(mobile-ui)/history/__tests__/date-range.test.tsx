import React from 'react'
import { render } from '@testing-library/react'

const mockTransactionCard = jest.fn()
const mockSetQueryData = jest.fn()
const mockInvalidateQueries = jest.fn()

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
    useFormatter: () => ({ dateTime: () => 'date' }),
}))
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ setQueryData: mockSetQueryData, invalidateQueries: mockInvalidateQueries }),
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
jest.mock('@/hooks/useHistoryRange', () => ({
    useHistoryRange: () => ({
        from: null,
        to: null,
        fromDate: undefined,
        toDate: undefined,
        fromIso: undefined,
        toIso: undefined,
        hasActiveRange: true,
        activePreset: 'allTime',
        setPreset: jest.fn(),
        setCustom: jest.fn(),
        isInRange: (date: Date) => date >= new Date('2026-08-01') && date < new Date('2026-09-01'),
    }),
}))
jest.mock('@/components/History/HistoryRangeDrawer', () => ({ HistoryRangeDrawer: () => null }))
jest.mock('@/components/History/ExportActivityDrawer', () => ({ ExportActivityDrawer: () => null }))
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

import { useWebSocket } from '@/hooks/useWebSocket'
import { completeHistoryEntry, type HistoryEntry } from '@/utils/history.utils'

describe('HistoryPage live date filter', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.mocked(completeHistoryEntry).mockImplementation(async (entry) => entry)
    })

    async function receive(createdAt: string | undefined, timestamp: string, kind = 'DIRECT_TRANSFER') {
        render(<HistoryPage />)
        const options = jest.mocked(useWebSocket).mock.calls.at(-1)![0]!
        await options.onHistoryEntry!({
            uuid: 'date-test',
            createdAt,
            timestamp: new Date(timestamp),
            amount: '1',
            extraData: { kind },
        } as HistoryEntry)
    }

    it('excludes July payments completed in August', async () => {
        await receive('2026-07-31T12:00:00Z', '2026-08-05T12:00:00Z')
        expect(mockSetQueryData).not.toHaveBeenCalled()
    })

    it('includes August payments completed in September', async () => {
        await receive('2026-08-31T12:00:00Z', '2026-09-05T12:00:00Z')
        expect(mockSetQueryData).toHaveBeenCalledTimes(1)
    })

    it('refreshes the server selection when a legacy event omits creation time', async () => {
        await receive(undefined, '2026-08-05T12:00:00Z')
        expect(mockSetQueryData).not.toHaveBeenCalled()
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ['transactions', 'infinite', { limit: 20, from: undefined, to: undefined }],
        })
    })

    it('uses the issuance timestamp for perk records without createdAt', async () => {
        await receive(undefined, '2026-08-05T12:00:00Z', 'PERK_REWARD')
        expect(mockSetQueryData).toHaveBeenCalledTimes(1)
    })
})

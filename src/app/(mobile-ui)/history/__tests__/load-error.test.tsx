import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

const mockCaptureException = jest.fn()
const mockRefetch = jest.fn()
const loadError = new Error('Failed to fetch history: Internal Server Error')

jest.mock('@sentry/nextjs', () => ({ captureException: (e: unknown) => mockCaptureException(e) }))
jest.mock('next-intl', () => ({
    useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
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
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: jest.fn() }))
jest.mock('@/hooks/useInfiniteScroll', () => ({ useInfiniteScroll: () => ({ loaderRef: { current: null } }) }))
jest.mock('@/hooks/useTransactionDetailsDrawer', () => ({
    useTransactionDetailsDrawer: () => ({
        isTransactionSelected: () => false,
        openTransactionDetails: jest.fn(),
        closeTransactionDetails: jest.fn(),
    }),
}))
jest.mock('@/hooks/useTransactionHistory', () => ({
    useTransactionHistory: () => ({
        data: undefined,
        hasNextPage: false,
        fetchNextPage: jest.fn(),
        isFetchingNextPage: false,
        isLoading: false,
        isError: true,
        error: loadError,
        refetch: mockRefetch,
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
jest.mock('@/components/Global/NavHeader', () => ({ title }: { title: string }) => <h1>{title}</h1>)
jest.mock('@/components/Global/Loading', () => () => null)
jest.mock('@/components/Global/EmptyStates/NoDataEmptyState', () => () => null)
jest.mock('@/components/TransactionDetails/TransactionCard', () => () => null)

import HistoryPage from '../page'

describe('HistoryPage when the history request fails', () => {
    beforeEach(() => {
        mockCaptureException.mockClear()
        mockRefetch.mockClear()
    })

    it('keeps the Activity header so the user can go back, and offers a retry', () => {
        render(<HistoryPage />)
        expect(screen.getByRole('heading', { name: 'history.title' })).toBeInTheDocument()
        expect(screen.getByText('history.errorTitle')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('history-retry'))
        expect(mockRefetch).toHaveBeenCalledTimes(1)
    })

    it('reports the failure once, not on every render', () => {
        const { rerender } = render(<HistoryPage />)
        rerender(<HistoryPage />)
        rerender(<HistoryPage />)
        expect(mockCaptureException).toHaveBeenCalledTimes(1)
        expect(mockCaptureException).toHaveBeenCalledWith(loadError)
    })
})

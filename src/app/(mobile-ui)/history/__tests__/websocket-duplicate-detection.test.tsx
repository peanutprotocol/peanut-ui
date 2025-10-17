/**
 * Tests for WebSocket duplicate detection in history page
 *
 * Critical test case:
 * - Duplicate transactions should be ignored to prevent showing same transaction twice
 */

import { QueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { TRANSACTIONS } from '@/constants/query.consts'

// Mock transaction entry type
type HistoryEntry = {
    uuid: string
    type: string
    status: string
    timestamp: string
    amount: string
}

type HistoryResponse = {
    entries: HistoryEntry[]
    hasMore: boolean
}

describe('History Page - WebSocket Duplicate Detection', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        })
    })

    // Simulate the WebSocket handler logic for adding new entries
    const handleNewHistoryEntry = (newEntry: HistoryEntry, limit: number = 20) => {
        queryClient.setQueryData<InfiniteData<HistoryResponse>>([TRANSACTIONS, 'infinite', { limit }], (oldData) => {
            if (!oldData) return oldData

            // Add new entry to the first page (with duplicate check)
            return {
                ...oldData,
                pages: oldData.pages.map((page, index) => {
                    if (index === 0) {
                        // Check if entry already exists to prevent duplicates
                        const isDuplicate = page.entries.some((entry) => entry.uuid === newEntry.uuid)
                        if (isDuplicate) {
                            console.log('[History] Duplicate transaction ignored:', newEntry.uuid)
                            return page
                        }
                        return {
                            ...page,
                            entries: [newEntry, ...page.entries],
                        }
                    }
                    return page
                }),
            }
        })
    }

    describe('Duplicate Detection', () => {
        it('should add new transaction when UUID is unique', () => {
            // Setup initial data
            const initialData: InfiniteData<HistoryResponse> = {
                pages: [
                    {
                        entries: [
                            { uuid: 'tx-1', type: 'SEND', status: 'COMPLETED', timestamp: '2025-01-01', amount: '10' },
                            {
                                uuid: 'tx-2',
                                type: 'RECEIVE',
                                status: 'COMPLETED',
                                timestamp: '2025-01-02',
                                amount: '20',
                            },
                        ],
                        hasMore: false,
                    },
                ],
                pageParams: [undefined],
            }

            queryClient.setQueryData([TRANSACTIONS, 'infinite', { limit: 20 }], initialData)

            // Add new unique transaction
            const newEntry: HistoryEntry = {
                uuid: 'tx-3',
                type: 'SEND',
                status: 'COMPLETED',
                timestamp: '2025-01-03',
                amount: '15',
            }

            handleNewHistoryEntry(newEntry)

            // Verify new entry was added
            const updatedData = queryClient.getQueryData<InfiniteData<HistoryResponse>>([
                TRANSACTIONS,
                'infinite',
                { limit: 20 },
            ])

            expect(updatedData?.pages[0].entries).toHaveLength(3)
            expect(updatedData?.pages[0].entries[0].uuid).toBe('tx-3') // Should be prepended
        })

        it('should NOT add transaction when UUID already exists (duplicate)', () => {
            // Setup initial data
            const initialData: InfiniteData<HistoryResponse> = {
                pages: [
                    {
                        entries: [
                            { uuid: 'tx-1', type: 'SEND', status: 'COMPLETED', timestamp: '2025-01-01', amount: '10' },
                            {
                                uuid: 'tx-2',
                                type: 'RECEIVE',
                                status: 'COMPLETED',
                                timestamp: '2025-01-02',
                                amount: '20',
                            },
                        ],
                        hasMore: false,
                    },
                ],
                pageParams: [undefined],
            }

            queryClient.setQueryData([TRANSACTIONS, 'infinite', { limit: 20 }], initialData)

            // Try to add duplicate transaction
            const duplicateEntry: HistoryEntry = {
                uuid: 'tx-1', // Same UUID as first entry!
                type: 'SEND',
                status: 'COMPLETED',
                timestamp: '2025-01-03',
                amount: '15',
            }

            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

            handleNewHistoryEntry(duplicateEntry)

            // Verify entry was NOT added
            const updatedData = queryClient.getQueryData<InfiniteData<HistoryResponse>>([
                TRANSACTIONS,
                'infinite',
                { limit: 20 },
            ])

            expect(updatedData?.pages[0].entries).toHaveLength(2) // Still only 2 entries
            expect(updatedData?.pages[0].entries[0].uuid).toBe('tx-1') // Original entry unchanged

            // Verify duplicate was logged
            expect(consoleLogSpy).toHaveBeenCalledWith('[History] Duplicate transaction ignored:', 'tx-1')

            consoleLogSpy.mockRestore()
        })

        it('should handle multiple pages correctly', () => {
            // Setup with multiple pages
            const initialData: InfiniteData<HistoryResponse> = {
                pages: [
                    {
                        entries: [
                            { uuid: 'tx-1', type: 'SEND', status: 'COMPLETED', timestamp: '2025-01-01', amount: '10' },
                        ],
                        hasMore: true,
                    },
                    {
                        entries: [
                            {
                                uuid: 'tx-2',
                                type: 'RECEIVE',
                                status: 'COMPLETED',
                                timestamp: '2025-01-02',
                                amount: '20',
                            },
                        ],
                        hasMore: false,
                    },
                ],
                pageParams: [undefined, 'cursor-1'],
            }

            queryClient.setQueryData([TRANSACTIONS, 'infinite', { limit: 20 }], initialData)

            // Add new entry
            const newEntry: HistoryEntry = {
                uuid: 'tx-3',
                type: 'SEND',
                status: 'COMPLETED',
                timestamp: '2025-01-03',
                amount: '15',
            }

            handleNewHistoryEntry(newEntry)

            const updatedData = queryClient.getQueryData<InfiniteData<HistoryResponse>>([
                TRANSACTIONS,
                'infinite',
                { limit: 20 },
            ])

            // Only first page should be modified
            expect(updatedData?.pages[0].entries).toHaveLength(2)
            expect(updatedData?.pages[1].entries).toHaveLength(1) // Second page unchanged
            expect(updatedData?.pages[0].entries[0].uuid).toBe('tx-3')
        })

        it('should handle empty pages gracefully', () => {
            // Setup with empty first page
            const initialData: InfiniteData<HistoryResponse> = {
                pages: [
                    {
                        entries: [],
                        hasMore: false,
                    },
                ],
                pageParams: [undefined],
            }

            queryClient.setQueryData([TRANSACTIONS, 'infinite', { limit: 20 }], initialData)

            // Add new entry
            const newEntry: HistoryEntry = {
                uuid: 'tx-1',
                type: 'SEND',
                status: 'COMPLETED',
                timestamp: '2025-01-01',
                amount: '10',
            }

            handleNewHistoryEntry(newEntry)

            const updatedData = queryClient.getQueryData<InfiniteData<HistoryResponse>>([
                TRANSACTIONS,
                'infinite',
                { limit: 20 },
            ])

            // Should successfully add to empty page
            expect(updatedData?.pages[0].entries).toHaveLength(1)
            expect(updatedData?.pages[0].entries[0].uuid).toBe('tx-1')
        })

        it('should detect duplicates even with different data fields', () => {
            const initialData: InfiniteData<HistoryResponse> = {
                pages: [
                    {
                        entries: [
                            { uuid: 'tx-1', type: 'SEND', status: 'COMPLETED', timestamp: '2025-01-01', amount: '10' },
                        ],
                        hasMore: false,
                    },
                ],
                pageParams: [undefined],
            }

            queryClient.setQueryData([TRANSACTIONS, 'infinite', { limit: 20 }], initialData)

            // Try to add entry with same UUID but different data
            const duplicateEntry: HistoryEntry = {
                uuid: 'tx-1', // Same UUID
                type: 'RECEIVE', // Different type
                status: 'PENDING', // Different status
                timestamp: '2025-01-03', // Different timestamp
                amount: '999', // Different amount
            }

            handleNewHistoryEntry(duplicateEntry)

            const updatedData = queryClient.getQueryData<InfiniteData<HistoryResponse>>([
                TRANSACTIONS,
                'infinite',
                { limit: 20 },
            ])

            // Should still reject because UUID matches
            expect(updatedData?.pages[0].entries).toHaveLength(1)
            expect(updatedData?.pages[0].entries[0]).toEqual({
                uuid: 'tx-1',
                type: 'SEND', // Original data preserved
                status: 'COMPLETED',
                timestamp: '2025-01-01',
                amount: '10',
            })
        })
    })
})

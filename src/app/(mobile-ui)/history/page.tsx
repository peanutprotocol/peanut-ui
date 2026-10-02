'use client'

import { type CardPosition } from '@/components/Global/Card/card.utils'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import NavHeader from '@/components/Global/NavHeader'
import Loading from '@/components/Global/Loading'
import { KycStatusItem } from '@/components/Kyc/KycStatusItem'
import TransactionCard from '@/components/TransactionDetails/TransactionCard'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { getUserPreferences } from '@/utils/general.utils'
import { DateGroup, getDateGroup, getDateGroupKey } from '@/utils/dateGrouping.utils'
import * as Sentry from '@sentry/nextjs'
import { isKycStatusItem, type KycHistoryEntry } from '@/components/Kyc/KycStatusItem'
import { buildKycHistoryEntry } from '@/utils/kyc-grouping.utils'
import { useAuth } from '@/context/authContext'
import { BadgeStatusItem } from '@/components/Badges/BadgeStatusItem'
import { isBadgeHistoryItem, type BadgeHistoryEntry } from '@/components/Badges/badge.types'
import { useFormatter, useTranslations } from 'next-intl'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { TRANSACTIONS } from '@/constants/query.consts'
import type { HistoryEntry, HistoryResponse } from '@/hooks/useTransactionHistory'
import { AccountType } from '@/interfaces/interfaces'
import { completeHistoryEntry, dedupeHistoryEntriesByUuid } from '@/utils/history.utils'
import { twMerge } from '@/utils/tw'
import { formatUnits } from 'viem'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { displayableBadges } from '@/constants/badges.consts'
import { translateTransactionName } from '@/components/TransactionDetails/transaction-name-keys'
import { HistoryFilterBar } from '@/features/history/HistoryFilterBar'
import { HistoryNoMatches } from '@/features/history/HistoryNoMatches'
import { useHistoryFilters } from '@/features/history/useHistoryFilters'
import { filterHistoryRows } from '@/features/history/historyFilters.utils'
import { normalizeEnsName } from '@/utils/ens-name.utils'
import { Button } from '@/components/0_Bruddle/Button'
import { isAddress } from 'viem'
import React, { useMemo, useState } from 'react'

/** pages fetched on their own while a filter is on, before asking the user to go further */
const FILTER_AUTO_PAGES = 3

/**
 * the oldest timestamp history is known to be loaded through while more pages
 * can still load, for placing badge and kyc rows. Infinity means nothing older
 * can be placed yet.
 *
 * uses the api cursor, not the oldest visible row: sources are interleaved and
 * some rows are filtered out, so a visible row can sit below unread ones.
 */
function getLoadedThroughMs(pages: HistoryResponse[] | undefined): number {
    if (!pages?.length) return Infinity
    // an earlier page's cursor is still a safe (newer) boundary if the latest is unusable
    for (let i = pages.length - 1; i >= 0; i--) {
        const ms = Date.parse(pages[i].cursor?.split('::')[0] ?? '')
        if (Number.isFinite(ms)) return ms
    }
    return Infinity
}

/**
 * displays the user's transaction history with infinite scrolling and date grouping.
 */
const HistoryPage = () => {
    const t = useTranslations('history')
    const tTransaction = useTranslations('transaction')
    const format = useFormatter()
    const { user } = useAuth()
    const queryClient = useQueryClient()
    // one `?tx=` subscription for the whole list — rows are memo'd and get
    // isSelected/open/close as props (see useTransactionDetailsDrawer)
    const { isTransactionSelected, openTransactionDetails, closeTransactionDetails } = useTransactionDetailsDrawer()
    const { fetchUser } = useAuth()
    // Synthetic card-unlock row inputs — same cached queries HomeHistory uses.
    const userId = user?.user.userId
    const { searchQuery, activeFilter, isFiltering, setSearchQuery, setFilter, clearFilters } = useHistoryFilters()
    const hideTxnAmount = useMemo(() => getUserPreferences(userId)?.balanceHidden ?? false, [userId])

    const {
        data: historyData,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
        isLoading,
        error,
        isError,
    } = useTransactionHistory({
        mode: 'infinite',
        limit: 20,
    })

    // A filter that matches little keeps the loader in view, and infinite scroll
    // would then walk the user's whole history on a typo. While filtering, it
    // gets a few pages each time filtering starts or the pill changes (not per
    // keystroke), then waits for "Search older activity". State adjusted
    // during render: React's pattern for resetting derived state.
    const loadedPages = historyData?.pages.length ?? 0
    const filterKey = isFiltering ? activeFilter : null
    const [pageBudget, setPageBudget] = useState({ key: filterKey, limit: loadedPages + FILTER_AUTO_PAGES })
    if (pageBudget.key !== filterKey) {
        setPageBudget({ key: filterKey, limit: Math.max(pageBudget.limit, loadedPages + FILTER_AUTO_PAGES) })
    }
    const isAutoFetchPaused = isFiltering && !!hasNextPage && loadedPages >= pageBudget.limit
    const searchOlder = () => setPageBudget({ key: filterKey, limit: loadedPages + FILTER_AUTO_PAGES })

    // infinite scroll hook
    const { loaderRef } = useInfiniteScroll({
        hasNextPage: !!hasNextPage && !isAutoFetchPaused,
        isFetchingNextPage,
        fetchNextPage,
    })

    // Real-time updates via WebSocket
    useWebSocket({
        username: user?.user.username ?? undefined,
        onHistoryEntry: async (newEntry) => {
            console.log('[History] New transaction received via WebSocket:', newEntry)

            // Process the entry through completeHistoryEntry to format amounts and add computed fields
            // This ensures WebSocket entries match the format of API-fetched entries
            let completedEntry
            try {
                completedEntry = await completeHistoryEntry(newEntry)
            } catch (error) {
                console.error('[History] Failed to process WebSocket entry:', error)
                Sentry.captureException(error, {
                    tags: { feature: 'websocket-history' },
                    extra: { entryType: newEntry.type, entryUuid: newEntry.uuid },
                })

                // Fallback: Use raw entry with proper amount formatting
                let fallbackAmount = newEntry.amount.toString()

                if (newEntry.extraData?.kind === 'CRYPTO_DEPOSIT' && newEntry.extraData?.blockNumber) {
                    try {
                        fallbackAmount = formatUnits(BigInt(newEntry.amount), PEANUT_WALLET_TOKEN_DECIMALS)
                    } catch (formatError) {
                        console.error('[History fallback] Failed to format deposit amount:', formatError)
                        fallbackAmount = '0.00' // Safer than showing wei
                    }
                }

                completedEntry = {
                    ...newEntry,
                    timestamp: new Date(newEntry.timestamp),
                    extraData: {
                        ...newEntry.extraData,
                        usdAmount: fallbackAmount,
                    },
                }
            }

            // Update TanStack Query cache with processed transaction
            queryClient.setQueryData<InfiniteData<HistoryResponse>>(
                [TRANSACTIONS, 'infinite', { limit: 20 }],
                (oldData) => {
                    if (!oldData) return oldData

                    // Check if entry exists on ANY page to prevent duplicates
                    const existsAnywhere = oldData.pages.some((p) =>
                        p.entries.some((e) => e.uuid === completedEntry.uuid)
                    )

                    if (existsAnywhere) {
                        console.log('[History] Duplicate transaction ignored:', completedEntry.uuid)
                        return oldData
                    }

                    // Add new entry to the first page
                    return {
                        ...oldData,
                        pages: oldData.pages.map((page, index) => {
                            if (index === 0) {
                                return {
                                    ...page,
                                    entries: [completedEntry, ...page.entries],
                                }
                            }
                            return page
                        }),
                    }
                }
            )

            // Invalidate balance query to refresh it (scoped to user's wallet address)
            const walletAddress = user?.accounts.find(
                (account) => account.type === AccountType.PEANUT_WALLET
            )?.identifier
            if (walletAddress) {
                queryClient.invalidateQueries({ queryKey: ['balance', walletAddress] })
            }
        },
        onKycStatusUpdate: async (newStatus: string) => {
            // refetch user data when kyc status changes so the status item appears immediately
            console.log('KYC status updated via WebSocket:', newStatus)
            await fetchUser()
        },
        onSumsubKycStatusUpdate: async (newStatus: string) => {
            console.log('Sumsub KYC status updated via WebSocket:', newStatus)
            await fetchUser()
        },
    })

    // Deduped: page overlap on the API cursor would otherwise render the same
    // payment twice in a row, which reads as a double charge.
    const allEntries = useMemo(
        () => dedupeHistoryEntriesByUuid(historyData?.pages.flatMap((page) => page.entries) ?? []),
        [historyData]
    )

    const combinedAndSortedEntries = useMemo(() => {
        if (isLoading) {
            return []
        }
        const entries: Array<HistoryEntry | BadgeHistoryEntry | KycHistoryEntry> = [...allEntries]

        // badge and kyc rows wait until history is loaded past them, so they
        // don't sit at the bottom and jump when older pages arrive. rows at the
        // cursor timestamp itself wait too, since equal timestamps can span pages.
        // once no further page can load, all of them show
        const loadedThroughMs = hasNextPage ? getLoadedThroughMs(historyData?.pages) : null
        const isLoadedThrough = (timestamp: string | Date) =>
            loadedThroughMs === null || new Date(timestamp).getTime() > loadedThroughMs

        // inject badge items from user profile, placed by earnedAt
        const badges = displayableBadges(user?.user?.badges ?? [])
        badges.forEach((b) => {
            if (!b.earnedAt || !isLoadedThrough(b.earnedAt)) return
            entries.push({
                isBadge: true,
                uuid: b.id ?? b.code,
                timestamp: new Date(b.earnedAt).toISOString(),
                code: b.code,
                name: b.name,
                description: b.description ?? undefined,
                iconUrl: b.iconUrl ?? undefined,
            })
        })

        // add the single identity-verification row (provider-agnostic)
        if (user) {
            const kycEntry = buildKycHistoryEntry(user)
            if (kycEntry && isLoadedThrough(kycEntry.timestamp)) entries.push(kycEntry)
        }

        entries.sort((a, b) => {
            const dateA = new Date(a.timestamp || 0).getTime()
            const dateB = new Date(b.timestamp || 0).getTime()
            return dateB - dateA
        })

        return entries
    }, [allEntries, historyData, hasNextPage, user, isLoading])

    // Memoize per-row drawer projection so the .map() below doesn't recompute
    // mapTransactionDataForDrawer per row on every parent rerender (websocket
    // tick, infinite-scroll fetch). One Map<uuid, mapped> per visible page.
    const drawerByUuid = useMemo(() => {
        const m = new Map<string, ReturnType<typeof mapTransactionDataForDrawer>>()
        for (const item of combinedAndSortedEntries) {
            if (isKycStatusItem(item) || isBadgeHistoryItem(item)) continue
            if (!m.has(item.uuid)) m.set(item.uuid, mapTransactionDataForDrawer(item))
        }
        return m
    }, [combinedAndSortedEntries])

    // Filters run over the pages loaded so far. Badge and identity rows are
    // timeline markers, not transactions, so any filter hides them. While a
    // filter is on and older pages remain, the loader below stays in view and
    // infinite scroll keeps fetching, so sparse matches still surface.
    const { visibleEntries, hasMatchesInAll } = useMemo(() => {
        if (!isFiltering) return { visibleEntries: combinedAndSortedEntries, hasMatchesInAll: true }
        const { visible, hasMatchesInAll } = filterHistoryRows(
            combinedAndSortedEntries,
            (item) => {
                if (isKycStatusItem(item) || isBadgeHistoryItem(item)) return null
                const mapped = drawerByUuid.get(item.uuid)
                if (!mapped) return null
                const { transactionDetails: details, transactionCardType } = mapped
                // the name the row shows: its localized label, or the ENS name
                // TransactionCard already resolved for an address (read from
                // that query's cache, so filtering never starts a lookup)
                const displayName = details.nameKey
                    ? translateTransactionName(tTransaction, details.nameKey, details.nameParams)
                    : isAddress(details.userName)
                      ? (normalizeEnsName(
                            queryClient.getQueryData<string | null>([
                                'ens-primary-name',
                                details.userName.toLowerCase(),
                            ])
                        ) ?? undefined)
                      : undefined
                return { type: transactionCardType, details, displayName }
            },
            activeFilter,
            searchQuery,
            { matchAmounts: !hideTxnAmount }
        )
        return { visibleEntries: visible, hasMatchesInAll }
    }, [
        isFiltering,
        combinedAndSortedEntries,
        drawerByUuid,
        activeFilter,
        searchQuery,
        tTransaction,
        queryClient,
        hideTxnAmount,
    ])

    if (isLoading && combinedAndSortedEntries.length === 0) {
        return <Loading variant="mascot" />
    }

    if (isError) {
        console.error(error)
        Sentry.captureException(error)
        return (
            <div className="mx-auto space-y-3 mt-6 w-full md:max-w-2xl">
                <h2 className="text-heading-card text-foreground-primary">{t('transactions')}</h2>{' '}
                <EmptyState icon="alert" iconColor="red" title={t('errorTitle')} description={t('errorDescription')} />
            </div>
        )
    }

    // keep the list (and its loader) while more pages can load: an empty first
    // page can still have older rows behind it
    if (!isLoading && !hasNextPage && combinedAndSortedEntries.length === 0) {
        return (
            <div className="flex h-[80dvh] flex-col items-center justify-center">
                <NavHeader title={t('title')} />
                <div className="flex flex-grow items-center justify-center">
                    <NoDataEmptyState animSize="lg" message={t('empty')} />
                </div>
            </div>
        )
    }

    const groupHeader = (date: Date, group: DateGroup): string => {
        if (group === DateGroup.Today) return t('today')
        if (group === DateGroup.Yesterday) return t('yesterday')
        return format.dateTime(date, { month: 'long', day: 'numeric', year: 'numeric' })
    }

    let lastGroupHeaderKey: string | null = null
    const today = new Date()

    return (
        <PageStack gap="6">
            <NavHeader title={t('title')} />
            <HistoryFilterBar
                query={searchQuery}
                onQueryChange={setSearchQuery}
                filter={activeFilter}
                onFilterChange={setFilter}
            />
            <div className="h-full w-full">
                {isFiltering &&
                    visibleEntries.length === 0 &&
                    (!hasNextPage || isAutoFetchPaused) &&
                    !isFetchingNextPage && (
                        <HistoryNoMatches
                            query={searchQuery}
                            filter={activeFilter}
                            hasMatchesInAll={hasMatchesInAll}
                            onClearSearch={() => setSearchQuery('')}
                            onShowAll={() => setFilter('all')}
                            onClearAll={clearFilters}
                        />
                    )}
                {visibleEntries.map((item, index) => {
                    const itemDate = new Date(item.timestamp)
                    const group = getDateGroup(itemDate, today)
                    const currentGroupHeaderKey = getDateGroupKey(itemDate, group)
                    const showHeader = currentGroupHeaderKey !== lastGroupHeaderKey
                    if (showHeader) {
                        lastGroupHeaderKey = currentGroupHeaderKey
                    }

                    // corners are per DATE GROUP: peek at the next entry to see
                    // if it starts a new group
                    const isFirstInGroup = showHeader
                    const nextItem = visibleEntries[index + 1]
                    const isLastInGroup =
                        !nextItem ||
                        getDateGroupKey(
                            new Date(nextItem.timestamp),
                            getDateGroup(new Date(nextItem.timestamp), today)
                        ) !== currentGroupHeaderKey

                    let position: CardPosition = 'middle'
                    if (isFirstInGroup && isLastInGroup) position = 'solo'
                    else if (isFirstInGroup) position = 'top'
                    else if (isLastInGroup) position = 'bottom'

                    return (
                        <React.Fragment key={item.uuid}>
                            {/* date group header — board 17966:12128: Label/M, 8px above the group's rows */}
                            {showHeader && (
                                <div
                                    className={twMerge(
                                        'mb-2 text-label-m text-foreground-primary',
                                        index > 0 && 'mt-2'
                                    )}
                                >
                                    {groupHeader(itemDate, group)}
                                </div>
                            )}
                            {isKycStatusItem(item) ? (
                                <KycStatusItem position={position} />
                            ) : isBadgeHistoryItem(item) ? (
                                <BadgeStatusItem position={position} entry={item} />
                            ) : (
                                (() => {
                                    const { transactionDetails, transactionCardType } =
                                        drawerByUuid.get(item.uuid) ?? mapTransactionDataForDrawer(item)
                                    return (
                                        <TransactionCard
                                            type={transactionCardType}
                                            name={transactionDetails.userName}
                                            amount={transactionDetails.amount ? Number(transactionDetails.amount) : 0}
                                            status={transactionDetails.status}
                                            initials={transactionDetails.initials}
                                            transaction={transactionDetails}
                                            position={position}
                                            haveSentMoneyToUser={transactionDetails.haveSentMoneyToUser}
                                            hideTxnAmount={hideTxnAmount}
                                            isSelected={isTransactionSelected(transactionDetails.id)}
                                            onOpen={openTransactionDetails}
                                            onClose={closeTransactionDetails}
                                        />
                                    )
                                })()
                            )}
                        </React.Fragment>
                    )
                })}

                <div ref={loaderRef} className="w-full py-4">
                    {isFetchingNextPage && (
                        <div className="w-full text-center">{isFiltering ? t('searchingOlder') : t('loadingMore')}</div>
                    )}
                    {isAutoFetchPaused && !isFetchingNextPage && (
                        <div className="flex justify-center">
                            <Button variant="secondary" size="small" className="w-fit" onClick={searchOlder}>
                                {t('searchOlder')}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </PageStack>
    )
}

export default HistoryPage

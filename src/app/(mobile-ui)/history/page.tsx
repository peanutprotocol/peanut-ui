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
import React, { useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { ExportActivityDrawer } from '@/components/History/ExportActivityDrawer'
import { HistoryRangeDrawer } from '@/components/History/HistoryRangeDrawer'
import { useHistoryRange } from '@/hooks/useHistoryRange'
import { useHistoryRangeLabel } from '@/hooks/useHistoryRangeLabel'
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

/**
 * displays the user's transaction history with infinite scrolling and date grouping.
 */
const HistoryPage = () => {
    const t = useTranslations('history')
    const format = useFormatter()
    const { user } = useAuth()
    const queryClient = useQueryClient()
    // one `?tx=` subscription for the whole list — rows are memo'd and get
    // isSelected/open/close as props (see useTransactionDetailsDrawer)
    const { isTransactionSelected, openTransactionDetails, closeTransactionDetails } = useTransactionDetailsDrawer()
    const { fetchUser } = useAuth()
    // Synthetic card-unlock row inputs — same cached queries HomeHistory uses.
    const userId = user?.user.userId
    const hideTxnAmount = useMemo(() => getUserPreferences(userId)?.balanceHidden ?? false, [userId])

    // timeframe filter (URL state) + the two drawers it feeds
    const { fromIso, toIso, hasActiveRange, isInRange } = useHistoryRange()
    const rangeLabel = useHistoryRangeLabel()
    const [rangeDrawerOpen, setRangeDrawerOpen] = useState(false)
    const [exportDrawerOpen, setExportDrawerOpen] = useState(false)

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
        from: fromIso,
        to: toIso,
    })

    // infinite scroll hook
    const { loaderRef } = useInfiniteScroll({
        hasNextPage,
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

            // Match the server's creation-time filter, even when settlement changes the display timestamp.
            const activityDate =
                completedEntry.createdAt ??
                (completedEntry.extraData?.kind === 'PERK_REWARD' ? completedEntry.timestamp : undefined)
            const withinActiveRange = !hasActiveRange || (activityDate && isInRange(new Date(activityDate)))
            if (hasActiveRange && !activityDate) {
                // Older event payloads need the server to decide period membership.
                queryClient.invalidateQueries({
                    queryKey: [TRANSACTIONS, 'infinite', { limit: 20, from: fromIso, to: toIso }],
                })
            }

            // Update TanStack Query cache with processed transaction
            if (withinActiveRange)
                queryClient.setQueryData<InfiniteData<HistoryResponse>>(
                    [TRANSACTIONS, 'infinite', { limit: 20, from: fromIso, to: toIso }],
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

        // inject badge items from user profile, placed by earnedAt — client-side
        // rows must respect the active timeframe filter like API rows do
        const badges = displayableBadges(user?.user?.badges ?? [])
        badges.forEach((b) => {
            if (!b.earnedAt) return
            if (hasActiveRange && !isInRange(new Date(b.earnedAt))) return
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
            if (kycEntry && (!hasActiveRange || isInRange(new Date(kycEntry.timestamp)))) entries.push(kycEntry)
        }

        entries.sort((a, b) => {
            const dateA = new Date(a.timestamp || 0).getTime()
            const dateB = new Date(b.timestamp || 0).getTime()
            return dateB - dateA
        })

        return entries
    }, [allEntries, user, isLoading])

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

    const filterButton = (
        <Button
            variant="stroke"
            className={twMerge(
                // nav circle recipe (board 17802:61534): 40px visual, pseudo-element to 44px
                'relative size-10 w-10 p-0 shadow-none after:absolute after:-inset-0.5',
                // an applied range borrows SegmentedControl's selected recipe:
                // action-primary border + the app's 10% selected tint, glyph stays
                // black. not-active: lets the stroke button's own full-pink press
                // show through (law 7) — a plain utility would override it.
                // No navigation-board row covers this; flagged ❓ in the PR body.
                hasActiveRange && 'border-action-primary not-active:bg-action-primary/10'
            )}
            aria-label={hasActiveRange ? t('range.titleActive', { range: rangeLabel }) : t('range.title')}
            onClick={() => setRangeDrawerOpen(true)}
            data-testid="history-filters"
        >
            <Icon name="list-filter" size={20} />
        </Button>
    )

    const drawers = (
        <>
            <HistoryRangeDrawer
                open={rangeDrawerOpen}
                onOpenChange={setRangeDrawerOpen}
                // export lives behind the filter sheet: Download closes it and
                // opens the export sheet, which starts from the applied range
                onDownload={() => {
                    setRangeDrawerOpen(false)
                    setExportDrawerOpen(true)
                }}
            />
            <ExportActivityDrawer open={exportDrawerOpen} onOpenChange={setExportDrawerOpen} />
        </>
    )

    if (isLoading && combinedAndSortedEntries.length === 0) {
        if (!hasActiveRange) return <Loading variant="mascot" />
        // keep the filter reachable while a filtered window loads
        return (
            <PageStack>
                <NavHeader title={t('title')} rightElement={filterButton} />
                <Loading />
                {drawers}
            </PageStack>
        )
    }

    if (isError) {
        console.error(error)
        Sentry.captureException(error)
        return (
            <div className="mx-auto space-y-3 mt-6 w-full md:max-w-2xl">
                <h2 className="text-heading-card text-foreground-primary">{t('transactions')}</h2>{' '}
                <EmptyState icon="alert" title={t('errorTitle')} description={t('errorDescription')} />
            </div>
        )
    }

    if (!isLoading && combinedAndSortedEntries.length === 0) {
        // an empty FILTERED window keeps the filter reachable — the user
        // changes the range from here
        if (hasActiveRange) {
            return (
                <PageStack>
                    <NavHeader title={t('title')} rightElement={filterButton} />
                    <EmptyState
                        icon="calendar"
                        title={t('emptyFiltered')}
                        description={t('emptyFilteredDescription')}
                    />
                    {drawers}
                </PageStack>
            )
        }
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
        <PageStack>
            <NavHeader title={t('title')} rightElement={filterButton} />
            <div className="h-full w-full">
                {combinedAndSortedEntries.map((item, index) => {
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
                    const nextItem = combinedAndSortedEntries[index + 1]
                    const isLastInGroup =
                        !nextItem ||
                        getDateGroupKey(
                            new Date(nextItem.timestamp),
                            getDateGroup(new Date(nextItem.timestamp), today)
                        ) !== currentGroupHeaderKey

                    let position: CardPosition = 'middle'
                    if (isFirstInGroup && isLastInGroup) position = 'single'
                    else if (isFirstInGroup) position = 'first'
                    else if (isLastInGroup) position = 'last'

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
                    {isFetchingNextPage && <div className="w-full text-center">{t('loadingMore')}</div>}
                </div>
            </div>
            {drawers}
        </PageStack>
    )
}

export default HistoryPage

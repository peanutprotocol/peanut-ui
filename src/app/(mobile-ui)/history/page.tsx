'use client'

import { type CardPosition } from '@/components/Global/Card/card.utils'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { KycStatusItem } from '@/components/Kyc/KycStatusItem'
import TransactionCard from '@/components/TransactionDetails/TransactionCard'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { useUserStore } from '@/redux/hooks'
import { DateGroup, getDateGroup, getDateGroupKey } from '@/utils/dateGrouping.utils'
import * as Sentry from '@sentry/nextjs'
import { isKycStatusItem } from '@/components/Kyc/KycStatusItem'
import { buildKycHistoryEntry } from '@/utils/kyc-grouping.utils'
import { useAuth } from '@/context/authContext'
import { BadgeStatusItem } from '@/components/Badges/BadgeStatusItem'
import { isBadgeHistoryItem } from '@/components/Badges/badge.types'
import CardUnlockHistoryItem from '@/components/Card/CardUnlockHistoryItem'
import { deriveCardUnlockEntry, isCardUnlockHistoryItem } from '@/components/Card/cardUnlock.types'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import React, { useMemo } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { TRANSACTIONS } from '@/constants/query.consts'
import type { HistoryResponse } from '@/hooks/useTransactionHistory'
import { AccountType } from '@/interfaces'
import { completeHistoryEntry } from '@/utils/history.utils'
import { formatUnits } from 'viem'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'

/**
 * displays the user's transaction history with infinite scrolling and date grouping.
 */
const HistoryPage = () => {
    const t = useTranslations('history')
    const format = useFormatter()
    const { user } = useUserStore()
    const queryClient = useQueryClient()
    const { fetchUser } = useAuth()
    // Synthetic card-unlock row inputs — same cached queries HomeHistory uses.
    const { cardInfo } = useCardInfo()
    const { overview: rainOverview } = useRainCardOverview()

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

    const allEntries = useMemo(() => historyData?.pages.flatMap((page) => page.entries) ?? [], [historyData])

    const combinedAndSortedEntries = useMemo(() => {
        if (isLoading) {
            return []
        }
        const entries: Array<any> = [...allEntries]

        // inject badge items from user profile, placed by earnedAt
        const badges = user?.user?.badges ?? []
        badges.forEach((b) => {
            if (!b.earnedAt) return
            entries.push({
                isBadge: true,
                uuid: b.id,
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
            if (kycEntry) entries.push(kycEntry)
        }

        // add the card-unlock milestone row, placed chronologically. Unlike
        // the home top-5 (where it ages out), the full page always carries it.
        if (cardInfo) {
            const unlock = deriveCardUnlockEntry({
                hasIssuedCard: (rainOverview?.cards.length ?? 0) > 0,
                hasCardAccess: cardInfo.hasCardAccess,
                cardAccessGrantedAt: cardInfo.waitlistReleasedAt,
                skipBadges: cardInfo.skipBadges,
                userBadges: user?.user?.badges,
            })
            if (unlock) entries.push(unlock)
        }

        entries.sort((a, b) => {
            const dateA = new Date(a.timestamp || 0).getTime()
            const dateB = new Date(b.timestamp || 0).getTime()
            return dateB - dateA
        })

        return entries
    }, [allEntries, user, isLoading, cardInfo, rainOverview])

    // Memoize per-row drawer projection so the .map() below doesn't recompute
    // mapTransactionDataForDrawer per row on every parent rerender (websocket
    // tick, infinite-scroll fetch). One Map<uuid, mapped> per visible page.
    const drawerByUuid = useMemo(() => {
        const m = new Map<string, ReturnType<typeof mapTransactionDataForDrawer>>()
        for (const item of combinedAndSortedEntries) {
            if (isKycStatusItem(item) || isBadgeHistoryItem(item) || isCardUnlockHistoryItem(item)) continue
            if (!m.has(item.uuid)) m.set(item.uuid, mapTransactionDataForDrawer(item))
        }
        return m
    }, [combinedAndSortedEntries])

    if (isLoading && combinedAndSortedEntries.length === 0) {
        return <PeanutLoading />
    }

    if (isError) {
        console.error(error)
        Sentry.captureException(error)
        return (
            <div className="mx-auto mt-6 w-full space-y-3 md:max-w-2xl">
                <h2 className="text-base font-bold">{t('transactions')}</h2>{' '}
                <EmptyState icon="alert" title={t('errorTitle')} description={t('errorDescription')} />
            </div>
        )
    }

    if (!isLoading && combinedAndSortedEntries.length === 0) {
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
        <div className="mx-auto w-full space-y-6 md:max-w-2xl md:space-y-3">
            <NavHeader title={t('title')} />
            <div className="h-full w-full">
                {combinedAndSortedEntries.map((item, index) => {
                    const itemDate = new Date(item.timestamp)
                    const group = getDateGroup(itemDate, today)
                    const currentGroupHeaderKey = getDateGroupKey(itemDate, group)
                    const showHeader = currentGroupHeaderKey !== lastGroupHeaderKey
                    if (showHeader) {
                        lastGroupHeaderKey = currentGroupHeaderKey
                    }

                    let position: CardPosition = 'middle'
                    const isFirstOverall = index === 0
                    const isLastOverall = index === combinedAndSortedEntries.length - 1
                    const isFirstInGroup = showHeader

                    if (combinedAndSortedEntries.length === 1) {
                        position = 'single'
                    } else if (isFirstInGroup && isLastOverall) {
                        position = 'single'
                    } else if (isFirstInGroup || isFirstOverall) {
                        position = 'first'
                    } else if (isLastOverall) {
                        position = 'last'
                    }

                    return (
                        <React.Fragment key={item.uuid}>
                            {showHeader && (
                                <div className="mb-2 mt-4 px-1 text-sm font-semibold capitalize">
                                    {groupHeader(itemDate, group)}
                                </div>
                            )}
                            {isKycStatusItem(item) ? (
                                <KycStatusItem position={position} />
                            ) : isBadgeHistoryItem(item) ? (
                                <BadgeStatusItem position={position} entry={item} />
                            ) : isCardUnlockHistoryItem(item) ? (
                                <CardUnlockHistoryItem
                                    entry={item}
                                    position={position}
                                    username={user?.user?.username ?? undefined}
                                    badges={user?.user?.badges}
                                />
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
        </div>
    )
}

export default HistoryPage

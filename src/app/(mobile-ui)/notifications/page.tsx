'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import Card from '@/components/Global/Card'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { notificationsApi, type InAppItem } from '@/services/notifications'
import { formatGroupHeaderDate, getDateGroup, getDateGroupKey } from '@/utils/dateGrouping.utils'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { PEANUTMAN_LOGO } from '@/assets'
import Link from 'next/link'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Button } from '@/components/0_Bruddle/Button'

export default function NotificationsPage() {
    const loadingRef = useRef<HTMLDivElement>(null)
    const [notifications, setNotifications] = useState<InAppItem[]>([])
    const [nextPageCursor, setNextPageCursor] = useState<string | null>(null)
    const [isInitialLoading, setIsInitialLoading] = useState(true)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
    const [markedIds, setMarkedIds] = useState<Set<string>>(new Set())

    const loadInitialPage = async () => {
        // load the first page of notifications
        setIsInitialLoading(true)
        setErrorMessage(null)
        try {
            const res = await notificationsApi.list({ limit: 20 })
            setNotifications(res.items)
            setNextPageCursor(res.nextCursor)
        } catch (_e) {
            // set an error state if api fails
            setErrorMessage('Failed to load notifications. Please try again.')
            setNotifications([])
            setNextPageCursor(null)
        } finally {
            setIsInitialLoading(false)
        }
    }

    useEffect(() => {
        void loadInitialPage()
    }, [])

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const target = entries[0]
                if (target.isIntersecting && nextPageCursor && !isLoadingMore) {
                    void loadNextPage()
                }
            },
            { threshold: 0.1 }
        )
        const element = loadingRef.current
        if (element) observer.observe(element)
        return () => {
            if (element) observer.unobserve(element)
        }
    }, [nextPageCursor, isLoadingMore])

    const loadNextPage = async () => {
        // load the next page when the sentinel enters the viewport
        if (!nextPageCursor) return
        setIsLoadingMore(true)
        setLoadMoreError(null)
        try {
            const res = await notificationsApi.list({ limit: 20, cursor: nextPageCursor })
            setNotifications((prev) => [...prev, ...res.items])
            setNextPageCursor(res.nextCursor)
        } catch (_e) {
            // show error below the list and allow retry
            setLoadMoreError('Failed to load more notifications. Tap to retry.')
        } finally {
            setIsLoadingMore(false)
        }
    }

    const grouped = useMemo(() => {
        const today = new Date()
        const groups: Array<{ header: string; items: InAppItem[] }> = []
        let lastKey: string | null = null
        for (const notif of notifications) {
            const d = new Date(notif.createdAt)
            const grp = getDateGroup(d, today)
            const key = getDateGroupKey(d, grp)
            const header = formatGroupHeaderDate(d, grp, today)
            if (key !== lastKey) {
                groups.push({ header, items: [notif] })
                lastKey = key
            } else {
                groups[groups.length - 1].items.push(notif)
            }
        }
        return groups
    }, [notifications])

    // mark notification as read when clicked
    const handleNotificationClick = (notifId: string) => {
        const notif = notifications.find((n) => n.id === notifId)
        if (!notif || notif.state.readAt || markedIds.has(notifId)) return

        // optimistically update ui
        setNotifications((prev) =>
            prev.map((it) =>
                it.id === notifId ? { ...it, state: { ...it.state, readAt: new Date().toISOString() } } : it
            )
        )
        setMarkedIds((prev) => new Set([...prev, notifId]))

        // fire-and-forget api call to mark as read
        void notificationsApi
            .markRead([notifId])
            .then(() => {
                // broadcast update so other ui (e.g. bell icon) can refresh unread count
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('notifications:updated'))
                }
            })
            .catch(() => {})
    }

    if (isInitialLoading && notifications.length === 0) {
        return <PeanutLoading />
    }

    return (
        <PageContainer>
            <div className="h-full w-full space-y-6">
                <NavHeader title="Notifications" />
                <div className="h-full w-full">
                    {/* error banner for partial failures */}
                    {!isInitialLoading && notifications.length > 0 && errorMessage && (
                        <div className="px-2">
                            <EmptyState title="Something went wrong" description={errorMessage ?? ''} icon="bell" />
                            <div className="mt-4 flex justify-center">
                                <Button shadowSize="4" onClick={() => void loadInitialPage()}>
                                    Retry
                                </Button>
                            </div>
                        </div>
                    )}

                    {!!grouped.length ? (
                        grouped.map((group, groupIdx) => {
                            return (
                                <React.Fragment key={groupIdx}>
                                    <div className="mb-2 mt-4 px-1 text-sm font-semibold capitalize">
                                        {group.header}
                                    </div>
                                    {group.items.map((notif, idx) => {
                                        let position: CardPosition = 'middle'
                                        if (group.items.length === 1) position = 'single'
                                        else if (idx === 0) position = 'first'
                                        else if (idx === group.items.length - 1) position = 'last'
                                        const href = notif.ctaDeeplink
                                        return (
                                            <Card
                                                key={notif.id}
                                                position={position}
                                                className="relative flex min-h-16 w-full items-center justify-center px-5 py-2"
                                                data-notification-id={notif.id}
                                            >
                                                <Link
                                                    href={href ?? ''}
                                                    className="flex w-full items-center gap-3"
                                                    data-notification-id={notif.id}
                                                    onClick={() => handleNotificationClick(notif.id)}
                                                >
                                                    <Image
                                                        src={notif.iconUrl ?? PEANUTMAN_LOGO}
                                                        alt="icon"
                                                        width={32}
                                                        height={32}
                                                        className="size-8 min-w-8 self-center"
                                                    />

                                                    <div className="flex min-w-0 flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <div className="line-clamp-2 font-semibold">
                                                                {notif.title}
                                                            </div>
                                                        </div>
                                                        {notif.body ? (
                                                            <div className="line-clamp-2 text-sm text-gray-600">
                                                                {notif.body}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </Link>
                                                {!notif.state.readAt ? (
                                                    <span className="absolute right-2 top-2 size-1.5 rounded-full bg-orange-2" />
                                                ) : null}
                                            </Card>
                                        )
                                    })}
                                </React.Fragment>
                            )
                        })
                    ) : (
                        <div>
                            {errorMessage ? (
                                <div className="px-2">
                                    <EmptyState title="Something went wrong" description={errorMessage} icon="bell" />
                                    <div className="mt-4 flex justify-center">
                                        <Button shadowSize="4" onClick={() => void loadInitialPage()}>
                                            Retry
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <EmptyState
                                    title="No notifications yet!"
                                    description="You will see your notifications here."
                                    icon="bell"
                                />
                            )}
                        </div>
                    )}
                    <div ref={loadingRef} className="w-full py-4">
                        {isLoadingMore && <div className="w-full text-center">Loading more...</div>}
                        {loadMoreError && (
                            <div className="w-full text-center text-sm text-red">
                                <button onClick={() => void loadNextPage()} className="underline">
                                    {loadMoreError}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}

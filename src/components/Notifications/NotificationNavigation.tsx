'use client'

import { useEffect, useState } from 'react'
import { Icon } from '../Global/Icons/Icon'
import Link from 'next/link'
import { notificationsApi } from '@/services/notifications'
import { twMerge } from 'tailwind-merge'

export default function NotificationNavigation() {
    const [notificationCount, setNotificationCount] = useState<number>(0)
    const [, setIsLoading] = useState<boolean>(false)

    useEffect(() => {
        const fetchNotificationCount = async () => {
            setIsLoading(true)
            try {
                const { count } = await notificationsApi.unreadCount()
                setNotificationCount(count)
            } catch (error) {
                console.error(error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchNotificationCount()

        // listen for notifications updates to refresh the badge
        const onUpdated = () => {
            void fetchNotificationCount()
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('notifications:updated', onUpdated)
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('notifications:updated', onUpdated)
            }
        }
    }, [])

    return (
        <Link href={'/notifications'} className={twMerge('relative')}>
            <Icon name="bell" size={20} />
            {notificationCount > 0 && <div className="bg-orange-2 absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full" />}
        </Link>
    )
}

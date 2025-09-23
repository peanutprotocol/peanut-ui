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
    }, [])

    return (
        <Link href={'/notifications'} className={twMerge('relative', notificationCount > 0 && 'animate-pulsate')}>
            <Icon name="bell" size={20} />
            {notificationCount > 0 && <div className="bg-orange-2 absolute -right-1 -top-1.5 h-2 w-2 rounded-full" />}
        </Link>
    )
}

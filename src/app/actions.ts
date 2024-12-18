'use server'

import webpush from 'web-push'
import { PEANUT_API_URL } from '@/constants'
import { cookies } from 'next/headers'

const updateSubscription = async ({ userId, pushSubscriptionId }: { userId: string; pushSubscriptionId: string }) => {
    return await fetch(`${PEANUT_API_URL}/update-user`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cookies().get('jwt-token')?.value}`,
            'api-key': process.env.PEANUT_API_KEY!,
        },
        body: JSON.stringify({
            userId,
            pushSubscriptionId,
        }),
    })
}

webpush.setVapidDetails(
    process.env.NEXT_PUBLIC_VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
)

let subscription: webpush.PushSubscription | null = null

export async function subscribeUser(
    userId: string,
    sub: {
        endpoint: string
        keys: {
            p256dh: string
            auth: string
        }
    }
) {
    try {
        await updateSubscription({
            userId,
            pushSubscriptionId: JSON.stringify(sub),
        })

        return { success: true }
    } catch (error) {
        console.error('Error updating subscription:', error)
        return { success: false, error: 'Failed to update subscription' }
    }
}

export async function unsubscribeUser() {
    subscription = null
    // In a production environment, you would want to remove the subscription from the database
    // For example: await db.subscriptions.delete({ where: { ... } })
    return { success: true }
}

export async function sendNotification(
    sub: webpush.PushSubscription,
    { message, title }: { message: string; title: string }
) {
    try {
        await webpush.sendNotification(
            sub,
            JSON.stringify({
                title,
                message,
                icon: '/icons/icon-192x192.png',
            })
        )
        return { success: true }
    } catch (error) {
        console.error('Error sending push notification:', error)
        return { success: false, error: 'Failed to send notification' }
    }
}

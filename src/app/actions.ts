'use server'

import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'
import { cookies } from 'next/headers'
import webpush from 'web-push'

const updateSubscription = async ({ userId, pushSubscriptionId }: { userId: string; pushSubscriptionId: string }) => {
    const cookieStore = cookies()
    const jwtToken = (await cookieStore).get('jwt-token')?.value

    return await fetchWithSentry(`${PEANUT_API_URL}/update-user`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtToken}`,
            'api-key': process.env.PEANUT_API_KEY!,
        },
        body: JSON.stringify({
            userId,
            pushSubscriptionId,
        }),
    })
}

// add validation for VAPID environment variables
const validateVapidEnv = () => {
    const vapidSubject = process.env.NEXT_PUBLIC_VAPID_SUBJECT
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

    if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
        throw new Error('VAPID environment variables are not set. Please check your environment configuration.')
    }

    return { vapidSubject, vapidPublicKey, vapidPrivateKey }
}

// initialize webpush with try-catch
try {
    const { vapidSubject, vapidPublicKey, vapidPrivateKey } = validateVapidEnv()

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
} catch (error) {
    console.error('Failed to initialize web push:', error)
    // in development, provide more helpful error message
    if (process.env.NODE_ENV === 'development') {
        console.info(`
            Please ensure you have the following environment variables set:
            - NEXT_PUBLIC_VAPID_SUBJECT (usually a mailto: URL)
            - NEXT_PUBLIC_VAPID_PUBLIC_KEY
            - VAPID_PRIVATE_KEY
        `)
        console.log('VAPID Subject:', process.env.NEXT_PUBLIC_VAPID_SUBJECT)
    }
}

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

'use server'

import webpush from 'web-push'

console.log(process.env.NEXT_PUBLIC_VAPID_SUBJECT_EMAIL)
console.log(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
console.log(process.env.VAPID_PRIVATE_KEY)

webpush.setVapidDetails(
    // Note: What email should be used here?
    'mailto:hugo@peanut.to',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
)

let subscription: webpush.PushSubscription | null = null

export async function subscribeUser(sub: {
    endpoint: string
    keys: {
        p256dh: string
        auth: string
    }
}) {
    subscription = sub as unknown as webpush.PushSubscription
    // In a production environment, you would want to store the subscription in a database
    // For example: await db.subscriptions.create({ data: sub })
    return { success: true }
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

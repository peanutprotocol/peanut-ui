import { NextRequest, NextResponse } from 'next/server'
const projectId = process.env.WC_PROJECT_ID
if (!projectId) {
    throw new Error('You need to provide WC_PROJECT_ID env variable')
}

export async function POST(request: NextRequest, response: NextResponse) {
    const notifyApiSecret = process.env.NOTIFY_API_SECRET
    if (!notifyApiSecret) {
        throw new Error('You need to provide NOTIFY_API_SECRET env variable')
    }
    if (request.method !== 'POST') {
        throw new ReferenceError('Method not allowed')
    }

    const notificationPayload = await request.json()
    if (!notificationPayload) {
        throw new Error('notificationpayload undefined')
    }

    try {
        await fetch(`https://notify.walletconnect.com/${projectId}/notify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${notifyApiSecret}`,
            },
            body: JSON.stringify(notificationPayload),
        })

        return NextResponse.json({
            status: 200,
        })
    } catch (error: any) {
        console.error('Error occured while sending notification:', error)

        return NextResponse.json({
            status: 500,
            body: {
                error: 'Error occured while sending notification',
            },
        })
    }
}

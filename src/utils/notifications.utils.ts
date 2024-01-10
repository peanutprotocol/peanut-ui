interface INotification {
    title: string
    body: string
    url: string | undefined
    type: string
}

export const sendNotification = async (notificationPayload: { accounts: string[]; notification: INotification }) => {
    console.log({ notificationPayload })
    await fetch('/api/notify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationPayload),
    })
}

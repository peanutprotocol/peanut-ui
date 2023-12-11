interface INotification {
    title: string
    body: string
    icon: string
    url: string | undefined
    type: string
}

export const sendNotification = async (notificationPayload: { accounts: string[]; notification: INotification }) => {
    console.log({ notificationPayload })
    const result = await fetch('/api/notify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationPayload),
    })

    // const gmRes = await result.json()
    // const { success, message } = gmRes

    // return { success, message }
}

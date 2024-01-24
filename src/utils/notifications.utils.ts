interface INotification {
    title: string
    body: string
    url: string | undefined
    type: string
}

export const sendNotification = async (senderAddress: string, recipientAddress: string | undefined, chainName: string) => {
    console.log('sendNotification', senderAddress)
    const accounts = [`eip155:1:${senderAddress}` ?? '']
    const notification: INotification = {
        title: 'Peanut Protocol',
        body: `Your link has been claimed on ${chainName} by ${recipientAddress ?? ''}`,
        url: undefined,
        type: '2aee6e5f-091d-444e-96cd-868ba2ddd0e7',
    }

    const notificationPayload = {
        notification,
        accounts,
    }
    console.log({ notificationPayload })

    await fetch('/api/notify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationPayload),
    })
}

import { interfaces } from '@squirrel-labs/peanut-sdk'

export async function fetchSendDiscordNotification({ message }: { message: string }) {
    const response = await fetch('/api/send-discord-notification', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message,
        }),
    })

    if (!response.ok) {
        throw new Error('Network response was not ok') //TODO: update error
    }

    const data = await response.json()

    return data
}

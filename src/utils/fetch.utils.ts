import { interfaces } from '@squirrel-labs/peanut-sdk'

export async function fetchUserName({ senderAddress, link }: { senderAddress: string; link: string }) {
    const response = await fetch('/api/get-username', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            senderAddress,
            link,
        }),
    })

    if (!response.ok) {
        throw new Error('Network response was not ok') //TODO: update error
    }

    const data = await response.json()

    return data
}

export async function fetchHasAddressParticipatedInRaffle({ link, address }: { link: string; address: string }) {
    const response = await fetch('/api/has-address-participated-in-raffle', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            link: link,
            address: address,
        }),
    })

    if (!response.ok) {
        throw new Error('Network response was not ok') //TODO: update error
    }

    const data = await response.json()

    return data
}

export async function fetchLeaderboardInfo({ link }: { link: string }) {
    const response = await fetch('/api/get-raffle-leaderboard', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ link }),
    })

    if (!response.ok) {
        throw new Error('Network response was not ok')
    }

    const data = await response.json()

    return data
}

export async function fetchClaimLinkGasless({
    link,
    recipientAddress,
    baseUrl,
}: {
    link: string
    recipientAddress: string
    baseUrl: string
}) {
    const response = await fetch('/api/claim-link-gasless', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            link,
            recipientAddress,
            baseUrl,
        }),
    })

    if (!response.ok) {
        throw new Error('Network response was not ok') //TODO: update error
    }

    const data = await response.json()

    return data
}

export async function fetchClaimLinkXchainGasless({
    link,
    recipientAddress,
    destinationChainId,
    destinationToken,
    isMainnet,
    squidRouterUrl,
    baseUrl,
}: {
    link: string
    recipientAddress: string
    destinationChainId: string
    destinationToken: string
    isMainnet: boolean
    squidRouterUrl: string
    baseUrl: string
}) {
    const response = await fetch('/api/claim-link-xchain-gasless', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            link,
            recipientAddress,
            destinationChainId,
            destinationToken,
            isMainnet,
            squidRouterUrl,
            baseUrl,
        }),
    })

    if (!response.ok) {
        throw new Error('Network response was not ok') //TODO: update error
    }

    const data = await response.json()

    return data
}

export async function fetchClaimRaffleLink({
    link,
    recipientAddress,
    recipientName,
}: {
    link: string
    recipientAddress: string
    recipientName: string
}) {
    const response = await fetch('/api/claim-raffle-link', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            link,
            recipientAddress,
            recipientName,
        }),
    })

    if (!response.ok) {
        throw new Error('Network response was not ok') //TODO: update error
    }

    const data = await response.json()

    return data
}

export async function fetchGetRaffleLinkFromTx({
    password,
    txHash,
    linkDetails,
    creatorAddress,
    numberOfLinks,
    provider,
    name,
}: {
    password: string
    txHash: string
    linkDetails: any //update type here
    creatorAddress: string
    numberOfLinks: number
    provider?: any
    name?: string
}) {
    const response = await fetch('/api/get-raffle-link-from-tx', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            password,
            txHash,
            linkDetails,
            creatorAddress,
            numberOfLinks,
            provider,
            name,
        }),
    })

    if (!response.ok) {
        throw new Error('Network response was not ok') //TODO: update error
    }

    const data = await response.json()

    return data
}

export async function fetchMakeGaslessDeposit({
    payload,
    signature,
    baseUrl,
}: {
    payload: interfaces.IGaslessDepositPayload
    signature: string
    baseUrl: string
}) {
    const response = await fetch('/api/make-gasless-deposit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            payload,
            signature,
            baseUrl,
        }),
    })

    console.log(response)

    if (!response.ok) {
        throw new Error('Network response was not ok') //TODO: update error
    }

    const data = await response.json()

    return data
}

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

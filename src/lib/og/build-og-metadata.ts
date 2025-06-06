import type { Metadata } from 'next'

interface BuildArgs {
    siteUrl: string
    type: 'send' | 'request' | 'generic'
    username?: string
    amount?: number
}

export function buildOgMetadata({ siteUrl, type, username, amount }: BuildArgs): Metadata {
    /* generic / invalid link */
    if (type === 'generic' || !username || !amount) {
        const ogImg = `${siteUrl}/api/og`
        return {
            title: 'Peanut payment link',
            description: 'Seamless payment infrastructure for sending and receiving digital assets.',
            openGraph: { images: [ogImg] },
            twitter: { card: 'summary_large_image', images: [ogImg] },
        }
    }

    /* dynamic title + og */
    const action = type === 'send' ? 'is sending you' : 'is requesting'
    const title = `${username} ${action} $${amount}`

    const ogUrl = new URL(`${siteUrl}/api/og`)
    ogUrl.searchParams.set('type', type)
    ogUrl.searchParams.set('username', username)
    ogUrl.searchParams.set('amount', String(amount))

    return {
        title,
        description:
            'Peanut Protocol | Payment Infrastructure – Seamless payment infrastructure for sending and receiving digital assets.',
        openGraph: {
            title,
            description: 'Seamless payment infrastructure for sending and receiving digital assets.',
            images: [{ url: ogUrl.toString(), width: 1200, height: 630 }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: 'Seamless payment infrastructure for sending and receiving digital assets.',
            images: [ogUrl.toString()],
        },
    }
}

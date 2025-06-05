import { BASE_URL } from '@/constants'
import { printableAddress } from '@/utils'
import { isAddress } from 'viem'
import PaymentLayoutWrapper from './payment-layout-wrapper'
import getOrigin from '@/lib/hosting/get-origin'

function getPreviewUrl(
    host: string,
    data: {
        tokenAmount?: string
        chainId?: string
        tokenAddress?: string
        tokenSymbol?: string
        recipientAddress?: string
    }
) {
    const url = new URL('/api/preview-image', host)
    const params = new URLSearchParams()

    if (data.tokenAmount) params.append('amount', data.tokenAmount)
    if (data.chainId) params.append('chainId', data.chainId)
    if (data.tokenAddress) params.append('tokenAddress', data.tokenAddress)
    if (data.tokenSymbol) params.append('tokenSymbol', data.tokenSymbol)
    if (data.recipientAddress) params.append('address', data.recipientAddress)
    params.append('previewType', 'REQUEST')

    url.search = params.toString()
    return url.toString()
}

export async function generateMetadata({ params }: any) {
    let title = 'Request Payment | Peanut'
    const siteUrl: string = (await getOrigin()) || BASE_URL // getOrigin for getting the origin of the site regardless of its a vercel preview or not

    let recipient = params.recipient[0]

    if (recipient.includes('%40') || recipient.includes('@')) {
        // split on @ or %40
        recipient = recipient.split(/%40|@/)[0] || 'Someone'
    }

    let amount, token
    if (params.recipient[1]) {
        const amountToken = params.recipient[1]
        const match = amountToken.match(/^(\d*\.?\d*)(.*)$/)
        if (match) {
            amount = match[1]
            token = match[2]
        }
    }

    const ogUrl = new URL(`${siteUrl}/api/og`)
    ogUrl.searchParams.set('type', 'request')
    ogUrl.searchParams.set('username', recipient)
    ogUrl.searchParams.set('amount', String(amount))

    if (!siteUrl) {
        console.error('Error: NEXT_PUBLIC_BASE_URL is not defined')
        return { title }
    }

    if (amount && token) {
        title = `${isAddress(recipient) ? printableAddress(recipient) : recipient} is requesting ${amount} ${token.toUpperCase()}`
    } else if (amount) {
        title = `${isAddress(recipient) ? printableAddress(recipient) : recipient} is requesting $${amount}`
    } else {
        title = `${isAddress(recipient) ? printableAddress(recipient) : recipient} | Peanut`
    }

    return {
        title,
        description: 'Send cryptocurrency to friends, family, or anyone else using Peanut on any chain.',
        icons: {
            icon: '/logo-favicon.png',
        },
        openGraph: {
            title,
            description: 'Seamless payment infrastructure for sending and receiving digital assets.',
            images: [{ url: ogUrl.toString(), width: 1200, height: 630 }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: 'Send cryptocurrency to friends, family, or anyone else using Peanut on any chain.',
            images: [ogUrl.toString()],
        },
    }
}

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
    return <PaymentLayoutWrapper>{children}</PaymentLayoutWrapper>
}

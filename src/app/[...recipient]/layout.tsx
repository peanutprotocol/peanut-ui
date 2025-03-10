import PaymentLayoutWrapper from './payment-layout-wrapper'

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
    let previewUrl = '/metadata-img.jpg'
    const host = process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me'

    if (!host) {
        console.error('Error: NEXT_PUBLIC_BASE_URL is not defined')
        return { title }
    }

    let recipient = params.recipient[0] || 'Someone'
    if (recipient.includes('%40') || recipient.includes('@')) {
        recipient = recipient.split(/[@%40]/)[0]
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

    const previewData = {
        tokenAmount: amount || '0',
        recipientAddress: recipient,
        tokenSymbol: token?.toUpperCase() || 'USD',
    }

    previewUrl = getPreviewUrl(host, previewData)

    if (amount && token) {
        title = `${recipient} is requesting ${amount} ${token.toUpperCase()}`
    } else if (amount) {
        title = `${recipient} is requesting $${amount}`
    } else {
        title = `${recipient} is requesting funds`
    }

    return {
        title,
        description: 'Send cryptocurrency to friends, family, or anyone else using Peanut on any chain.',
        icons: {
            icon: '/logo-favicon.png',
        },
        openGraph: {
            images: [{ url: previewUrl }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: 'Send cryptocurrency to friends, family, or anyone else using Peanut on any chain.',
        },
        keywords: 'crypto payment, crypto transfer, crypto send, payment link',
    }
}

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
    return <PaymentLayoutWrapper>{children}</PaymentLayoutWrapper>
}

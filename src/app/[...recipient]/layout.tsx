import { PreviewType } from '@/components/Global/ImageGeneration/LinkPreview'
import { parsePaymentURL } from '@/lib/url-parser/parser'
import { requestsApi } from '@/services/requests'
import { formatAmount, printableAddress } from '@/utils'
import { Metadata } from 'next'
import PaymentLayoutWrapper from './payment-layout-wrapper'

export const dynamic = 'force-dynamic'

type Props = {
    params: { recipient: string[] }
    searchParams: { [key: string]: string | string[] | undefined }
}

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
    params.append('previewType', PreviewType.REQUEST)

    url.search = params.toString()
    return url.toString()
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
    let title = 'Request Payment | Peanut'
    let previewUrl = '/metadata-img.jpg'
    const host = process.env.NEXT_PUBLIC_BASE_URL!

    try {
        const requestId = searchParams.id
            ? Array.isArray(searchParams.id)
                ? searchParams.id[0]
                : searchParams.id
            : undefined

        if (requestId) {
            const requestDetails = await requestsApi.get(requestId)
            const previewData = {
                tokenAmount: requestDetails.tokenAmount,
                chainId: requestDetails.chainId,
                tokenAddress: requestDetails.tokenAddress,
                tokenSymbol: requestDetails.tokenSymbol,
                recipientAddress: requestDetails.recipientAddress,
            }

            const name = requestDetails.recipientAddress ? printableAddress(requestDetails.recipientAddress) : 'Someone'
            title = `${name} is requesting ${formatAmount(Number(requestDetails.tokenAmount))} ${requestDetails.tokenSymbol}`
            previewUrl = getPreviewUrl(host, previewData)
        } else if (params.recipient) {
            const { parsedUrl, error } = await parsePaymentURL(params.recipient)

            if (parsedUrl && !error) {
                const previewData = {
                    tokenAmount: parsedUrl.amount,
                    chainId: parsedUrl.chain?.chainId,
                    tokenAddress: parsedUrl.token?.address,
                    tokenSymbol: parsedUrl.token?.symbol,
                    recipientAddress: parsedUrl.recipient.resolvedAddress,
                }

                const name = parsedUrl.recipient.identifier
                const amount = parsedUrl.amount || '0'
                const symbol = parsedUrl.token?.symbol || 'tokens'

                title = `Send ${formatAmount(Number(amount))} ${symbol} to ${name}`
                previewUrl = getPreviewUrl(host, previewData)
            }
        }
    } catch (e) {
        console.error('Error generating metadata:', e)
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
    return (
        <>
            <PaymentLayoutWrapper>{children}</PaymentLayoutWrapper>
        </>
    )
}

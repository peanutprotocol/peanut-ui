import { PayRequestLink } from '@/components/Request/Pay/Pay'
import { chargesApi } from '@/services/charges'
import { formatAmount, printableAddress } from '@/utils'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id?: string }>
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

function getPreviewUrl(
    host: string,
    data: {
        tokenAmount: string
        chainId: string
        tokenAddress: string
        tokenSymbol: string
        recipientAddress: string
    }
) {
    const url = new URL('/api/og', host)

    const params = new URLSearchParams({
        type: 'request',
        username: data.recipientAddress ?? '',
        amount: data.tokenAmount,
        token: data.tokenSymbol ?? '',
    })

    url.search = params.toString()
    return url.toString()
}

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Params
    searchParams: SearchParams
}): Promise<Metadata> {
    const resolvedSearchParams = await searchParams

    let title = 'Request Payment | Peanut'
    let previewUrl = '/metadata-img.png'
    const uuid = resolvedSearchParams.id
        ? Array.isArray(resolvedSearchParams.id)
            ? resolvedSearchParams.id[0]
            : resolvedSearchParams.id
        : undefined

    if (uuid) {
        try {
            const charge = await chargesApi.get(uuid)
            const name = charge.requestLink.recipientAddress
                ? printableAddress(charge.requestLink.recipientAddress)
                : 'Someone'
            title = `${name} is requesting ${formatAmount(Number(charge.tokenAmount))} ${charge.tokenSymbol}`
            previewUrl = getPreviewUrl(process.env.NEXT_PUBLIC_BASE_URL!, {
                ...charge,
                recipientAddress: charge.requestLink.recipientAddress,
            })
        } catch (e) {
            console.error('Failed to fetch charge for metadata:', e)
        }
    }

    return {
        title,
        description: 'Request cryptocurrency from friends, family, or anyone else using Peanut on any chain.',
        icons: {
            icon: '/favicon.ico',
        },
        openGraph: {
            images: [
                {
                    url: previewUrl,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: 'Request cryptocurrency from friends, family, or anyone else using Peanut on any chain.',
        },
        keywords: 'crypto request, crypto payment, crypto invoice, crypto payment link',
    }
}

export default function RequestPay() {
    return <PayRequestLink />
}

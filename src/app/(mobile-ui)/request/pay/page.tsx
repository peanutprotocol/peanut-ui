import { Metadata } from 'next'
import { PreviewType } from '@/components/Global/ImageGeneration/LinkPreview'
import { formatAmount, printableAddress } from '@/utils'
import { PayRequestLink } from '@/components/Request/Pay/Pay'
import { chargesApi } from '@/services/charges'

export const dynamic = 'force-dynamic'

type Props = {
    params: { id: string }
    searchParams: { [key: string]: string | string[] | undefined }
}

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
    const url = new URL('/api/preview-image', host)

    const params = new URLSearchParams({
        amount: data.tokenAmount,
        chainId: data.chainId,
        tokenAddress: data.tokenAddress,
        tokenSymbol: data.tokenSymbol ?? '',
        address: data.recipientAddress ?? '',
        previewType: PreviewType.REQUEST,
    })

    url.search = params.toString()
    return url.toString()
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
    let title = 'Request Payment | Peanut'
    let previewUrl = '/metadata-img.jpg'
    const uuid = searchParams.id ? (Array.isArray(searchParams.id) ? searchParams.id[0] : searchParams.id) : undefined
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
        } catch (e) {}
    }
    return {
        title,
        description: 'Request cryptocurrency from friends, family, or anyone else using Peanut on any chain.',
        icons: {
            icon: '/logo-favicon.png',
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

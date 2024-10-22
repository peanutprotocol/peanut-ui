import { Metadata } from 'next'
import Layout from '@/components/Global/Layout'
import { PayRequestLink } from '@/components'
import { headers } from 'next/headers'
import { PreviewType } from '@/components/Global/ImageGeneration/LinkPreview'
import { IRequestLinkData } from '@/components/Request/Pay/Pay.consts'
import { formatAmount } from '@/utils'

export const dynamic = 'force-dynamic'

type Props = {
    params: { id: string }
    searchParams: { [key: string]: string | string[] | undefined }
}

function getPreviewUrl(host: string, data: IRequestLinkData): string {
    const url = new URL('/api/preview-image', host)

    const params = new URLSearchParams({
        amount: data.tokenAmount,
        chainId: data.chainId,
        tokenAddress: data.tokenAddress,
        tokenSymbol: data.tokenSymbol ?? '',
        address: data.recipientAddress,
        previewType: PreviewType.REQUEST,
    })

    url.search = params.toString()
    return url.toString()
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
    let title = 'Request Payment'
    let previewUrl = '/metadata-img.jpg'
    let host = headers().get('host') || 'peanut.to'
    host = `${process.env.NODE_ENV === 'development' ? 'http://' : 'https://'}${host}`
    try {
        const linkRes = await fetch(`${host}/api/proxy/get/request-links/${searchParams.id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        if (linkRes.ok) {
            const linkDetails: IRequestLinkData = await linkRes.json()
            title = `${linkDetails.recipientAddress} is requesting ${formatAmount(Number(linkDetails.tokenAmount))} ${linkDetails.tokenSymbol}`
            previewUrl = getPreviewUrl(host, linkDetails)
        }
    } catch (e) {}
    return {
        title,
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
    }
}

export default function RequestPay() {
    return (
        <Layout className="!mx-0 w-full !px-0 !pt-0 ">
            <PayRequestLink />
        </Layout>
    )
}

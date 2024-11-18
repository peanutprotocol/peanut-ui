import { Metadata } from 'next'
import { peanut } from '@squirrel-labs/peanut-sdk'
import Layout from '@/components/Global/Layout'
import { PayRequestLink } from '@/components'
import { PreviewType } from '@/components/Global/ImageGeneration/LinkPreview'
import { formatAmount, printableAddress } from '@/utils'

export const dynamic = 'force-dynamic'

type Props = {
    params: { id: string }
    searchParams: { [key: string]: string | string[] | undefined }
}

function getPreviewUrl(host: string, data: Awaited<ReturnType<typeof peanut.getRequestLinkDetails>>) {
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
    let title = 'Request Payment'
    let previewUrl = '/metadata-img.jpg'
    const uuid = searchParams.id ? (Array.isArray(searchParams.id) ? searchParams.id[0] : searchParams.id) : undefined
    if (uuid) {
        const host = process.env.NEXT_PUBLIC_BASE_URL!
        try {
            const linkDetails = await peanut.getRequestLinkDetails({
                uuid,
                apiUrl: `${host}/api/proxy/get`,
            })
            const name = linkDetails.recipientAddress ? printableAddress(linkDetails.recipientAddress) : 'Someone'
            title = `${name} is requesting ${formatAmount(Number(linkDetails.tokenAmount))} ${linkDetails.tokenSymbol}`
            previewUrl = getPreviewUrl(host, linkDetails)
        } catch (e) {
            console.error('Error fetching request link details:', e)
        }
    }
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

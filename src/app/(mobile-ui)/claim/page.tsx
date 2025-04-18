import { Claim } from '@/components'
import { formatAmount } from '@/utils'
import { Metadata } from 'next'
import { getLinkDetails } from '@/app/actions/claimLinks'

export const dynamic = 'force-dynamic'

type Props = {
    params: { id: string }
    searchParams: { [key: string]: string | string[] | undefined }
}

function createURL(host: string, searchParams: { [key: string]: string | string[] | undefined }): string {
    const queryParams = new URLSearchParams()

    host = `${host}/claim`

    Object.keys(searchParams).forEach((key) => {
        const value = searchParams[key]
        if (Array.isArray(value)) {
            value.forEach((item) => queryParams.append(key, item))
        } else if (value) {
            queryParams.append(key, value)
        }
    })

    return `${host}?${queryParams.toString()}`
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
    let title = 'Claim your tokens!'
    const host = process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me'

    let linkDetails = undefined
    // only if we have params
    if (searchParams.i && searchParams.c) {
        try {
            const url = createURL(host, searchParams)
            linkDetails = await getLinkDetails(url)

            if (!linkDetails.claimed) {
                title =
                    'You received ' +
                    (Number(linkDetails.tokenAmount) < 0.01
                        ? 'some '
                        : formatAmount(Number(linkDetails.tokenAmount)) + ' in ') +
                    linkDetails.tokenSymbol +
                    '!'
            } else {
                title = 'This link has been claimed'
            }
        } catch (e) {
            console.log('error: ', e)
        }
    }

    let previewUrl = '/claim-metadata-img.jpg'
    if (linkDetails && !linkDetails.claimed) {
        const url = new URL('/api/preview-image', host)
        const params = new URLSearchParams()

        params.append('amount', linkDetails.tokenAmount.toString())
        params.append('tokenSymbol', linkDetails.tokenSymbol)
        params.append('address', linkDetails.senderAddress)
        params.append('previewType', 'CLAIM')

        url.search = params.toString()
        previewUrl = url.toString()
    }

    return {
        title: title,
        icons: {
            icon: '/favicon.ico',
        },
        openGraph: {
            images: [
                {
                    url: previewUrl,
                    width: 400,
                    height: 200,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: 'Claim your tokens using Peanut Protocol',
            images: [previewUrl],
        },
    }
}

export default function ClaimPage() {
    return <Claim />
}

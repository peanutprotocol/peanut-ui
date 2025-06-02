import { getLinkDetails } from '@/app/actions/claimLinks'
import { Claim } from '@/components'
import { BASE_URL } from '@/constants'
import { formatAmount } from '@/utils'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ id?: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}): Promise<Metadata> {
    const resolvedSearchParams = await searchParams

    let title = 'Claim Payment | Peanut'
    const host = BASE_URL

    let linkDetails = undefined
    if (resolvedSearchParams.i && resolvedSearchParams.c) {
        try {
            const queryParams = new URLSearchParams()
            Object.entries(resolvedSearchParams).forEach(([key, val]) => {
                if (Array.isArray(val)) {
                    val.forEach((v) => queryParams.append(key, v))
                } else if (val) {
                    queryParams.append(key, val)
                }
            })
            const url = `${host}/claim?${queryParams.toString()}`
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

    let previewUrl = '/metadata-img.png'
    if (linkDetails && !linkDetails.claimed) {
        const url = new URL('/api/preview-image', host)
        url.searchParams.append('amount', linkDetails.tokenAmount.toString())
        url.searchParams.append('tokenSymbol', linkDetails.tokenSymbol)
        url.searchParams.append('address', linkDetails.senderAddress)
        url.searchParams.append('previewType', 'CLAIM')
        previewUrl = url.toString()
    }

    return {
        title,
        description: 'Receive this payment to your Peanut account, or directly to your bank account.',
        icons: { icon: '/favicon.ico' },
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

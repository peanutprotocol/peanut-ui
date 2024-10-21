import * as components from '@/components'
import Layout from '@/components/Global/Layout'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { getLinkDetails } from '@squirrel-labs/peanut-sdk'
import * as utils from '@/utils'

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

    let host = headers().get('host') || 'peanut.to'
    host = `${process.env.NODE_ENV === 'development' ? 'http://' : 'https://'}${host}`
    let linkDetails = undefined
    try {
        const url = createURL(host, searchParams)
        linkDetails = await getLinkDetails({ link: url })
        if (!linkDetails.claimed) {
            title =
                'You received ' +
                (Number(linkDetails.tokenAmount) < 0.01
                    ? 'some '
                    : utils.formatAmount(Number(linkDetails.tokenAmount)) + ' in ') +
                linkDetails.tokenSymbol +
                '!'
        } else {
            title = 'This link has been claimed'
        }
    } catch (e) {
        console.log('error: ', e)
    }

    let previewUrl = '/claim-metadata-img.jpg'
    if (linkDetails) {
        previewUrl = `${host}/api/preview-image?amount=${linkDetails.tokenAmount}&chainId=${linkDetails.chainId}&tokenAddress=${linkDetails.tokenAddress}&tokenSymbol=${linkDetails.tokenSymbol}&senderAddress=${linkDetails.senderAddress}&tokenPrice=${undefined}`
    }
    return {
        title: title,
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

export default function ClaimPage() {
    return (
        <Layout>
            <components.Claim />
        </Layout>
    )
}

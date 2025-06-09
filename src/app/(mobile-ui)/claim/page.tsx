import { getLinkDetails } from '@/app/actions/claimLinks'
import { Claim } from '@/components'
import { BASE_URL } from '@/constants'
import getOrigin from '@/lib/hosting/get-origin'
import { sendLinksApi } from '@/services/sendLinks'
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
    const siteUrl: string = (await getOrigin()) || BASE_URL // getOrigin for getting the origin of the site regardless of its a vercel preview or not

    let linkDetails = undefined
    let txDetails = undefined
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
            const url = `${siteUrl}/claim?${queryParams.toString()}`
            
            const [linkDetailsResult, txDetailsResult] = await Promise.allSettled([
                getLinkDetails(url),
                sendLinksApi.getNoPubKey(url)
            ])
            
            linkDetails = linkDetailsResult.status === 'fulfilled' ? linkDetailsResult.value : undefined
            txDetails = txDetailsResult.status === 'fulfilled' ? txDetailsResult.value : undefined

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


    let previewUrl;
    if (linkDetails && !linkDetails.claimed) {
        const ogUrl = new URL(`${siteUrl}/api/og`)
        ogUrl.searchParams.set('type', 'send')
        ogUrl.searchParams.set('username', txDetails!.sender.username)
        ogUrl.searchParams.set('amount', Math.floor(Number(linkDetails.tokenAmount)).toString()) // @bozzi ALWAYS ROUNDING DOWN JUST IN CASE (also, design looked like it didn't accept decimals) 
        previewUrl = ogUrl.toString()
    }

    return {
        title,
        description: 'Receive this payment to your Peanut account, or directly to your bank account.',
        icons: { icon: '/favicon.ico' },
        openGraph: {
            images: [
                {
                    url: previewUrl!,
                    width: 1200,
                    height: 630,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: 'Claim your tokens using Peanut Protocol',
            images: [previewUrl!],
        },
    }
}

export default function ClaimPage() {
    return <Claim />
}

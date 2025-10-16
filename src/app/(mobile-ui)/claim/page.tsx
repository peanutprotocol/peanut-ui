import { getLinkDetails } from '@/app/actions/claimLinks'
import { Claim } from '@/components'
import { BASE_URL } from '@/constants'
import { formatAmount, resolveAddressToUsername } from '@/utils'
import { type Metadata } from 'next'
import getOrigin from '@/lib/hosting/get-origin'

export const dynamic = 'force-dynamic'

async function getClaimLinkData(searchParams: { [key: string]: string | string[] | undefined }, siteUrl: string) {
    if (!searchParams.i || !searchParams.c) return null

    try {
        const queryParams = new URLSearchParams()
        Object.entries(searchParams).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                val.forEach((v) => queryParams.append(key, v))
            } else if (val) {
                queryParams.append(key, val)
            }
        })

        const url = `${siteUrl}/claim?${queryParams.toString()}`
        const linkDetails = await getLinkDetails(url)

        // Get username from sender address
        const username = linkDetails?.senderAddress
            ? await resolveAddressToUsername(linkDetails.senderAddress, siteUrl)
            : null

        if (username) {
            console.log('username', username)
        }

        return { linkDetails, username }
    } catch (e) {
        console.log('error: ', e)
        return null
    }
}

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ id?: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}): Promise<Metadata> {
    const resolvedSearchParams = await searchParams
    const siteUrl: string = (await getOrigin()) || BASE_URL

    let title = 'Claim Payment | Peanut'
    const claimData = await getClaimLinkData(resolvedSearchParams, siteUrl)

    if (claimData?.linkDetails) {
        const { linkDetails, username } = claimData

        if (!linkDetails.claimed) {
            title = username
                ? `${username} sent you $${formatAmount(Number(linkDetails.tokenAmount))} via Peanut`
                : `You received ${Number(linkDetails.tokenAmount) < 0.01 ? 'some ' : formatAmount(Number(linkDetails.tokenAmount)) + ' in '}${linkDetails.tokenSymbol}!`
        } else {
            title = 'This link has been claimed'
        }
    }

    // Generate OG image URL
    let ogImageUrl = '/metadata-img.png'
    if (claimData?.linkDetails) {
        const { linkDetails, username } = claimData
        const ogUrl = new URL(`${siteUrl}/api/og`)
        ogUrl.searchParams.set('type', 'send')
        ogUrl.searchParams.set('username', username || linkDetails.senderAddress)

        if (!linkDetails.claimed) {
            // for unclaimed links, show claim preview
            ogUrl.searchParams.set('amount', linkDetails.tokenAmount.toString())
            ogUrl.searchParams.set('token', linkDetails.tokenSymbol)
        } else {
            // for claimed links, show claimed status
            ogUrl.searchParams.set('isReceipt', 'true')
        }

        if (!siteUrl) {
            console.error('Error: Unable to determine site origin')
        } else {
            ogImageUrl = ogUrl.toString()
        }
    }

    const description = claimData?.linkDetails?.claimed
        ? 'This payment link has already been claimed.'
        : 'Tap the link to receive instantly and without fees.'

    return {
        title,
        description,
        ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
        icons: {
            icon: '/favicon.ico',
        },
        openGraph: {
            title,
            description,
            images: [{ url: ogImageUrl, width: 1200, height: 630 }],
            type: 'website',
            siteName: 'Peanut',
        },
        twitter: {
            card: 'summary_large_image',
            site: '@PeanutProtocol',
            creator: '@PeanutProtocol',
            title,
            description,
            images: [
                {
                    url: ogImageUrl,
                },
            ],
        },
    }
}

export default function ClaimPage() {
    return <Claim />
}

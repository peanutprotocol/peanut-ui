import { Claim } from '@/components'
import { BASE_URL } from '@/constants'
import { formatAmount, resolveAddressToUsername } from '@/utils'
import { type Metadata } from 'next'
import getOrigin from '@/lib/hosting/get-origin'
import { sendLinksApi } from '@/services/sendLinks'
import { formatUnits } from 'viem'

export const dynamic = 'force-dynamic'

async function getClaimLinkData(searchParams: { [key: string]: string | string[] | undefined }, siteUrl: string) {
    if (!searchParams.i || !searchParams.c) return null

    try {
        // Use backend API with belt-and-suspenders logic (DB + blockchain fallback)
        const contractVersion = (searchParams.v as string) || 'v4.3'

        const sendLink = await sendLinksApi.getByParams({
            chainId: searchParams.c as string,
            depositIdx: searchParams.i as string,
            contractVersion,
        })

        // Get token details for proper formatting
        // We could enhance this to use backend token cache, but for now use blockchain
        const { fetchTokenDetails } = await import('@/app/actions/tokens')
        let tokenDecimals = 6
        let tokenSymbol = 'USDC'

        if (sendLink.tokenDecimals !== undefined && sendLink.tokenSymbol) {
            // Use backend data if available
            tokenDecimals = sendLink.tokenDecimals
            tokenSymbol = sendLink.tokenSymbol
        } else {
            // Fallback: fetch token details from blockchain
            try {
                const { fetchTokenDetails } = await import('@/app/actions/tokens')
                const tokenDetails = await fetchTokenDetails(sendLink.tokenAddress, sendLink.chainId)
                tokenDecimals = tokenDetails.decimals
                tokenSymbol = tokenDetails.symbol
            } catch (e) {
                console.error('Failed to fetch token details:', e)
                // Keep defaults
            }
        }

        // Transform to linkDetails format for metadata
        const linkDetails = {
            senderAddress: sendLink.senderAddress,
            tokenAmount: formatUnits(sendLink.amount, tokenDecimals),
            tokenSymbol,
            claimed: sendLink.status === 'CLAIMED' || sendLink.status === 'CANCELLED',
        }

        // Get username from sender - use sender.username if available (from backend)
        let username: string | null = sendLink.sender?.username || null

        // If no username in backend data, try ENS resolution with timeout
        if (!username && linkDetails.senderAddress) {
            try {
                const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
                username = await Promise.race([
                    resolveAddressToUsername(linkDetails.senderAddress, siteUrl),
                    timeoutPromise,
                ])
            } catch (ensError) {
                console.error('ENS resolution failed:', ensError)
                username = null
            }
        }

        if (username) {
            console.log('Resolved username:', username)
        }

        return { linkDetails, username }
    } catch (e) {
        console.error('Error fetching claim link data:', e)
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

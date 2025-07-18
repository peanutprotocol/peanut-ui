import { getLinkDetails } from '@/app/actions/claimLinks'
import { Claim } from '@/components'
import { BASE_URL } from '@/constants'
import { formatAmount } from '@/utils'
import { Metadata } from 'next'
import getOrigin from '@/lib/hosting/get-origin'
import { JustaName } from '@justaname.id/sdk'
import { rpcUrls } from '@/constants/general.consts'
import { mainnet } from 'viem/chains'

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
    let username = undefined
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
            linkDetails = await getLinkDetails(url)

            // Get username from sender address
            if (linkDetails?.senderAddress) {
                try {
                    const mainnetRpcUrl = rpcUrls[mainnet.id]?.[0]
                    const justAName = JustaName.init({
                        networks: [
                            {
                                chainId: 1, // Ethereum Mainnet
                                providerUrl: mainnetRpcUrl || 'https://eth.llamarpc.com',
                            },
                        ],
                        ensDomains: [
                            {
                                chainId: 1,
                                ensDomain: process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || 'testvc.eth',
                                apiKey: process.env.JUSTANAME_API_KEY || '',
                            },
                        ],
                        config: {
                            domain: 'peanut.me',
                            origin: siteUrl,
                        },
                    })

                    const ensName = await justAName.subnames.getPrimaryNameByAddress({
                        address: linkDetails.senderAddress,
                    })

                    if (ensName) {
                        // Strip peanut.me domain to get username
                        const peanutEnsDomain = process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || ''
                        username = ensName.name.replace(peanutEnsDomain, '').replace(/\.$/, '')
                        console.log('username', username)
                    }
                } catch (ensError) {
                    console.log('ENS resolution error: ', ensError)
                }
            }

            if (!linkDetails.claimed) {
                title = username + ' is requesting ' + formatAmount(Number(linkDetails.tokenAmount)) + ' via Peanut'
            } else {
                title = 'This link has been claimed'
            }
        } catch (e) {
            console.log('error: ', e)
        }
    }

    // Use the social preview logic from recipient page
    let ogImageUrl = '/metadata-img.png'
    if (linkDetails) {
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

    const description = linkDetails?.claimed
        ? 'This payment link has already been claimed.'
        : 'Receive this payment to your Peanut account, or directly to your bank account.'

    return {
        title,
        description,
        icons: {
            icon: '/logo-favicon.png',
        },
        openGraph: {
            title,
            description: 'Tap the link to pay instantly and without fees.',
            images: [{ url: ogImageUrl, width: 1200, height: 630 }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: 'Claim your tokens using Peanut Protocol',
            images: [ogImageUrl],
        },
    }
}

export default function ClaimPage() {
    return <Claim />
}

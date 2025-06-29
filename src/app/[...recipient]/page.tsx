import PageContainer from '@/components/0_Bruddle/PageContainer'
import { use } from 'react'
import PaymentPage from './client'
import getOrigin from '@/lib/hosting/get-origin'
import { BASE_URL } from '@/constants'
import { isAddress } from 'viem'
import { printableAddress } from '@/utils'
import { chargesApi } from '@/services/charges'
import { parseAmountAndToken } from '@/lib/url-parser/parser'

type PageProps = {
    params: Promise<{ recipient?: string[] }>
}

export async function generateMetadata({ params, searchParams }: any) {
    let title = 'Request Payment | Peanut'
    const siteUrl: string = (await getOrigin()) || BASE_URL // getOrigin for getting the origin of the site regardless of its a vercel preview or not
    const resolvedSearchParams = await searchParams
    const resolvedParams = await params

    let recipient = resolvedParams.recipient[0]

    if (recipient.includes('%40') || recipient.includes('@')) {
        // split on @ or %40
        recipient = recipient.split(/%40|@/)[0] || 'Someone'
    }

    const chargeId = resolvedSearchParams.chargeId

    // Parse amount/token from URL for request links
    let amount, token
    if (resolvedParams.recipient[1]) {
        const amountToken = resolvedParams.recipient[1]
        const parsed = parseAmountAndToken(amountToken)
        amount = parsed.amount
        token = parsed.token
    }

    // Check if recipient is ETH address or ENS name
    const isEthAddress = isAddress(recipient)
    const isEnsName = recipient.endsWith('.eth')
    const isAddressOrEns = isEthAddress || isEnsName

    // Determine if we should generate custom OG image
    const shouldGenerateCustomOG = amount || isAddressOrEns

    let isPaid = false
    let ogImageUrl = '/metadata-img.png' // Default fallback

    // Only check charge status if there's a chargeId
    if (chargeId) {
        try {
            const chargeDetails = await chargesApi.get(chargeId)
            console.log('chargeDetails', chargeDetails)
            isPaid = chargeDetails?.fulfillmentPayment?.status === 'SUCCESSFUL'
        } catch (error) {
            console.error('Failed to fetch charge details:', error)
        }
    }

    // Generate custom OG image only for addresses/ENS or when there's an amount
    if (shouldGenerateCustomOG) {
        if (!siteUrl) {
            console.error('Error: Unable to determine site origin')
        } else {
            const ogUrl = new URL(`${siteUrl}/api/og`)
            ogUrl.searchParams.set('type', 'request')
            ogUrl.searchParams.set('username', recipient)

            if (amount) {
                ogUrl.searchParams.set('amount', String(amount))
                if (token) {
                    ogUrl.searchParams.set('token', token.toUpperCase())
                }
            } else {
                // For ETH addresses/ENS without amount, set to 0 to show "is requesting funds"
                ogUrl.searchParams.set('amount', '0')
            }

            // Only show as receipt if there's both a chargeId AND it's paid
            if (chargeId && isPaid) {
                ogUrl.searchParams.set('isReceipt', 'true')
            }

            ogImageUrl = ogUrl.toString()
        }
    }

    // Generate appropriate title
    if (amount && token) {
        title = `${isEthAddress ? printableAddress(recipient) : recipient} is requesting ${amount} ${token.toUpperCase()}`
    } else if (amount) {
        title = `${isEthAddress ? printableAddress(recipient) : recipient} is requesting $${amount}`
    } else if (isAddressOrEns) {
        title = `${isEthAddress ? printableAddress(recipient) : recipient} is requesting funds`
    } else {
        // For Peanut usernames without amounts, use generic title
        title = `${recipient} | Peanut`
    }

    return {
        title,
        description: 'Send cryptocurrency to friends, family, or anyone else using Peanut on any chain.',
        ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
        icons: {
            icon: '/logo-favicon.png',
        },
        openGraph: {
            title,
            description: 'Seamless payment infrastructure for sending and receiving digital assets.',
            images: [{ url: ogImageUrl, width: 1200, height: 630 }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: 'Send cryptocurrency to friends, family, or anyone else using Peanut on any chain.',
            images: [ogImageUrl],
        },
    }
}

export default function Page(props: PageProps) {
    const params = use(props.params)
    const recipient = params.recipient ?? []
    return (
        <PageContainer className="min-h-[inherit]">
            <PaymentPage recipient={recipient} />
        </PageContainer>
    )
}

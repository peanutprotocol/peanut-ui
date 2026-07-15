import PageContainer from '@/components/0_Bruddle/PageContainer'
import { use } from 'react'
import PaymentPage from './client'
import getOrigin from '@/lib/hosting/get-origin'
import { BASE_URL } from '@/constants/general.consts'
import { isAddress } from 'viem'
import { printableAddress, isStableCoin } from '@/utils/general.utils'
import { chargesApi } from '@/services/charges'
import { parseAmountAndToken } from '@/lib/url-parser/parser'
import { buildOgImageUrl } from '@/utils/og.utils'
import { notFound } from 'next/navigation'
import { couldBeRecipient, isReservedRoute } from '@/constants/routes'

type PageProps = {
    params: Promise<{ recipient?: string[] }>
}

export async function generateMetadata({ params, searchParams }: any) {
    const resolvedSearchParams = await searchParams
    const resolvedParams = await params

    // Guard: Don't generate metadata for reserved routes (handled by their specific routes)
    const firstSegment = resolvedParams.recipient?.[0]
    if (firstSegment && isReservedRoute(`/${firstSegment}`)) {
        return {}
    }

    // Guard: Ensure recipient exists
    if (!resolvedParams.recipient?.[0]) {
        return {}
    }

    // Guard: Don't generate "X on Peanut" metadata for things that can't be recipients
    // (bare locale codes, slugs with dashes, random strings). Lets the 404 page own the tab title.
    if (!couldBeRecipient(firstSegment!)) {
        return {}
    }

    let title = 'Request Payment | Peanut'
    const siteUrl: string = (await getOrigin()) || BASE_URL // getOrigin for getting the origin of the site regardless of its a vercel preview or not

    let recipient = resolvedParams.recipient[0].toLowerCase()

    if (recipient.includes('%40') || recipient.includes('@')) {
        // split on @ or %40
        recipient = recipient.split(/%40|@/)[0] || 'Someone'
    }

    const chargeId = resolvedSearchParams.chargeId

    // Parse amount/token from URL for request links
    let amount, token
    if (resolvedParams.recipient[1]) {
        try {
            const parsed = parseAmountAndToken(resolvedParams.recipient[1])
            amount = parsed.amount
            token = parsed.token
        } catch {
            // malformed amount segment (e.g. /0x…@42161/1.2.3usdc) — fall back
            // to default metadata instead of 500ing the whole page render
        }
    }

    // Check if recipient is ETH address or ENS name
    const isEthAddress = isAddress(recipient)
    const isEnsName = recipient.endsWith('.eth')
    const isAddressOrEns = isEthAddress || isEnsName

    // If params length is 1 that means its a profile link
    const isPeanutUsername = resolvedParams.recipient.length === 1 && !isEthAddress && !isEnsName

    // Determine if we should generate custom OG image
    const shouldGenerateCustomOG = amount || isAddressOrEns || chargeId || isPeanutUsername

    let isPaid = false
    let ogImageUrl = '/metadata-img.png' // Default fallback
    let username = null

    // Only check charge status if there's a chargeId
    if (chargeId) {
        try {
            const chargeDetails = await chargesApi.get(chargeId)
            isPaid = chargeDetails?.fulfillmentPayment?.status === 'SUCCESSFUL'
            if (isPaid) {
                // If the charge is paid (i.e its a receipt), we need to get the username of the payer
                username = chargeDetails.payments.find((payment) => payment.status === 'SUCCESSFUL')?.payerAccount?.user
                    ?.username
            } else {
                username = chargeDetails.requestee?.username
            }

            // If we don't have amount/token from URL but have chargeId, get them from charge details
            if (!amount && chargeDetails) {
                amount = chargeDetails.tokenAmount
                token = chargeDetails.tokenSymbol
            }
        } catch (error) {
            console.error('Failed to fetch charge details:', error)
        }
    }

    // Generate custom OG image only for addresses/ENS or when there's an amount
    if (shouldGenerateCustomOG) {
        if (!siteUrl) {
            console.error('Error: Unable to determine site origin')
        } else {
            ogImageUrl = buildOgImageUrl(
                {
                    type: 'request',
                    username: recipient,
                    // ETH addresses/ENS without an amount use 0 to show "is requesting funds"
                    amount: amount ? String(amount) : '0',
                    token: amount && token ? token.toUpperCase() : undefined,
                    // only a receipt when there's a chargeId AND it's paid
                    isReceipt: Boolean(chargeId && isPaid),
                    isPeanutUsername,
                },
                siteUrl
            )
        }
    }

    // Generate appropriate title and description
    let description = 'Tap the link to pay instantly and without fees.'

    // Check if this is a receipt (chargeId exists and charge is paid)
    const isReceipt = chargeId && isPaid

    // Determine how to display the amount (with token symbol or $)
    // Stablecoins (USDC, USDT, etc.) should show as $, other tokens show with their symbol
    const isTokenDenominated = token && !isStableCoin(token)
    // Guard against undefined amount to avoid "$undefined" in titles
    const amountDisplay = amount
        ? isTokenDenominated && token
            ? `${amount} ${token.toUpperCase()}`
            : `$${amount}`
        : null

    if (isReceipt) {
        // Receipt case - show who shared the receipt
        const displayName = username || (isEthAddress ? printableAddress(recipient) : recipient)
        title = amountDisplay
            ? `${displayName} shared a receipt for ${amountDisplay} via Peanut`
            : `${displayName} shared a receipt via Peanut`
        description = 'Tap to view the payment details instantly and securely.'
    } else if (amountDisplay) {
        title = `${isEthAddress ? printableAddress(recipient) : recipient} is requesting ${amountDisplay} via Peanut`
    } else if (isAddressOrEns) {
        title = `${isEthAddress ? printableAddress(recipient) : recipient} is requesting funds`
    } else if (chargeId) {
        // For request links with chargeId but no amount/token info, use generic title
        title = `${isEthAddress ? printableAddress(recipient) : recipient} | Peanut`
    } else {
        // For Peanut usernames without amounts, use generic title
        title = `${recipient} on Peanut`
        description = `Check ${recipient}’s profile, send or request money instant in one tap, fee-free and secure.`
    }

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

export default function Page(props: PageProps) {
    const params = use(props.params)
    const recipient = params.recipient ?? []

    // Guard: Reserved routes should be handled by their specific route files
    // If we reach here, it means Next.js routing didn't catch it properly
    const firstSegment = recipient[0]
    if (firstSegment && isReservedRoute(`/${firstSegment}`)) {
        notFound()
    }

    // Guard: anything that can't be a username/address/ENS/handle is a 404, not a profile.
    // Pre-Feb-21 indexed URLs like /es/argentina previously fell through here and rendered
    // a "es on Peanut" profile page — that's the regression this guards against.
    if (firstSegment && !couldBeRecipient(firstSegment)) {
        notFound()
    }

    return (
        <PageContainer>
            <PaymentPage recipient={recipient} />
        </PageContainer>
    )
}

import { PEANUT_WALLET_TOKEN_DECIMALS, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'
import { sendLinksApi } from '@/services/sendLinks'
import { resolveAddressToUsername } from '@/utils/ens.utils'
import { formatAmount } from '@/utils/general.utils'
import { buildOgImageUrl } from '@/utils/og.utils'
import { type Metadata } from 'next'
import { formatUnits } from 'viem'

export type ClaimLinkDetails = {
    senderAddress: string
    tokenAmount: string
    tokenSymbol: string
    claimed: boolean
}

export type ClaimLinkData = {
    linkDetails: ClaimLinkDetails
    username: string | null
}

/**
 * Fetches the data needed to render a claim link's social preview from its
 * query params (`?c=<chainId>&v=<contractVersion>&i=<depositIdx>`).
 *
 * Uses the password-less `/send-links` lookup (DB + on-chain fallback) so it
 * can run during SSR metadata generation. Returns `null` when the link can't
 * be resolved — the caller then falls back to the generic Peanut preview.
 */
export async function getClaimLinkData(
    searchParams: { [key: string]: string | string[] | undefined },
    siteUrl: string
): Promise<ClaimLinkData | null> {
    const chainId = typeof searchParams.c === 'string' ? searchParams.c : undefined
    const depositIdx = typeof searchParams.i === 'string' ? searchParams.i : undefined
    if (!chainId || !depositIdx) return null

    try {
        const contractVersion = (typeof searchParams.v === 'string' && searchParams.v) || 'v4.3'
        const sendLink = await sendLinksApi.getByParams({ chainId, depositIdx, contractVersion })

        const tokenDecimals = sendLink.tokenDecimals ?? PEANUT_WALLET_TOKEN_DECIMALS
        const tokenSymbol = sendLink.tokenSymbol ?? PEANUT_WALLET_TOKEN_SYMBOL

        const linkDetails: ClaimLinkDetails = {
            senderAddress: sendLink.senderAddress,
            tokenAmount: formatUnits(sendLink.amount, tokenDecimals),
            tokenSymbol,
            claimed: sendLink.status === 'CLAIMED' || sendLink.status === 'CANCELLED',
        }

        let username = sendLink.sender?.username || null

        // Fall back to ENS reverse-resolution when the sender has no Peanut
        // handle. Race a 3s timeout so a slow ENS lookup never stalls metadata.
        if (!username && linkDetails.senderAddress) {
            let timeoutId: ReturnType<typeof setTimeout> | undefined
            const timeout = new Promise<null>((resolve) => {
                timeoutId = setTimeout(() => resolve(null), 3000)
            })
            const resolved = resolveAddressToUsername(linkDetails.senderAddress, siteUrl).catch(() => null)
            try {
                username = await Promise.race([resolved, timeout])
            } finally {
                clearTimeout(timeoutId)
            }
        }

        return { linkDetails, username }
    } catch {
        return null
    }
}

/**
 * Builds the Open Graph / Twitter metadata for a claim link from already
 * fetched data. Pure + synchronous so the title and OG-image logic is unit
 * testable — this is the exact behaviour that silently regressed when the
 * claim page's `generateMetadata` was stripped for the native build.
 */
export function buildClaimMetadata({
    claimData,
    siteUrl,
}: {
    claimData: ClaimLinkData | null
    siteUrl: string
}): Metadata {
    let title = 'Claim Payment | Peanut'
    let ogImageUrl = '/metadata-img.png'

    if (claimData) {
        const { linkDetails, username } = claimData
        const amount = Number(linkDetails.tokenAmount)

        if (linkDetails.claimed) {
            title = 'This link has been claimed'
        } else if (username) {
            title = `${username} sent you $${formatAmount(amount)} via Peanut`
        } else {
            title = `You received ${amount < 0.01 ? 'some ' : `${formatAmount(amount)} in `}${linkDetails.tokenSymbol}!`
        }

        // claimed links show the "receipt" variant; unclaimed show amount + token
        ogImageUrl = buildOgImageUrl(
            linkDetails.claimed
                ? { type: 'send', username: username || linkDetails.senderAddress, isReceipt: true }
                : {
                      type: 'send',
                      username: username || linkDetails.senderAddress,
                      amount: linkDetails.tokenAmount,
                      token: linkDetails.tokenSymbol,
                  },
            siteUrl
        )
    }

    const description = claimData?.linkDetails.claimed
        ? 'This payment link has already been claimed.'
        : 'Tap the link to receive instantly and without fees.'

    return {
        title,
        description,
        metadataBase: new URL(siteUrl),
        icons: { icon: '/favicon.ico' },
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
            images: [{ url: ogImageUrl }],
        },
    }
}

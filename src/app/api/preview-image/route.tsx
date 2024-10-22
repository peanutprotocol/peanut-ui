/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og'

import { LinkPreviewImg } from '@/components/Global/ImageGeneration/LinkPreview'

export const runtime = 'edge'

// Generate link preview image
// Note that a lot of usual CSS is unsupported, including tailwind.
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)

    const amount = searchParams.get('amount') ?? ''
    const chainId = searchParams.get('chainId') ?? ''
    const tokenAddress = searchParams.get('tokenAddress') ?? ''
    const tokenSymbol = searchParams.get('tokenSymbol') ?? ''
    const senderAddress = searchParams.get('senderAddress') ?? ''

    return new ImageResponse(<LinkPreviewImg {...{ amount, chainId, tokenAddress, tokenSymbol, senderAddress }} />, {
        width: 400,
        height: 200,
    })
}

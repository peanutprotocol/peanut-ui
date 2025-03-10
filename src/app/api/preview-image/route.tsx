/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og'

import { LinkPreviewImg, PreviewType } from '@/components/Global/ImageGeneration/LinkPreview'

export const runtime = 'edge'

// Generate link preview image
// Note that a lot of usual CSS is unsupported, including tailwind.
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)

    const amount = searchParams.get('amount') ?? ''
    const tokenSymbol = searchParams.get('tokenSymbol') ?? ''
    const address = searchParams.get('address') ?? ''
    const previewType =
        PreviewType[(searchParams.get('previewType')?.toUpperCase() ?? 'claim') as keyof typeof PreviewType] ??
        PreviewType.CLAIM

    return new ImageResponse(<LinkPreviewImg {...{ amount, tokenSymbol, address, previewType }} />, {
        width: 400,
        height: 200,
    })
}

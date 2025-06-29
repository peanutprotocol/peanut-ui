/* eslint-disable @next/next/no-img-element */
import { LinkPreviewImg, PreviewType } from '@/components/Global/ImageGeneration/LinkPreview'
import { ImageResponse } from 'next/og'
import { isAddress } from 'viem'
import { NextResponse } from 'next/server'

export const runtime = 'edge'

// DEPRECATED: This endpoint is deprecated. Use /api/og instead.
// This endpoint will be removed in a future version.
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)

    // Log deprecation warning
    console.warn('DEPRECATED: /api/preview-image endpoint is deprecated. Use /api/og instead.')

    // Extract parameters from the old format
    const amount = searchParams.get('amount') ?? ''
    const tokenSymbol = searchParams.get('tokenSymbol') ?? ''
    const address = searchParams.get('address') ?? ''
    const previewType = searchParams.get('previewType')?.toLowerCase() ?? 'claim'

    // Redirect to new og endpoint with proper parameters
    const baseUrl = new URL(request.url).origin
    const ogUrl = new URL('/api/og', baseUrl)

    // Map old parameters to new format
    ogUrl.searchParams.set('type', previewType === 'request' ? 'request' : 'send')
    ogUrl.searchParams.set('username', address)
    if (amount) {
        ogUrl.searchParams.set('amount', amount)
    }
    if (tokenSymbol) {
        ogUrl.searchParams.set('token', tokenSymbol)
    }

    // Return a redirect response to the new endpoint
    return NextResponse.redirect(ogUrl.toString(), 301)
}

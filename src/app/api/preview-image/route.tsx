/* eslint-disable @next/next/no-img-element */
import { LinkPreviewImg, PreviewType } from '@/components/Global/ImageGeneration/LinkPreview'
import { ImageResponse } from 'next/og'
import { isAddress } from 'viem'

export const runtime = 'edge'

// utility function to resolve ENS name of an address
async function resolveAddress(address: string): Promise<string | null> {
    if (!isAddress(address)) return null

    try {
        const response = await fetch(`https://api.justaname.id/ens/v1/subname/address?address=${address}&chainId=1`, {
            headers: {
                Accept: '*/*',
            },
        })

        if (!response.ok) {
            return null
        }

        const data = await response.json()

        // handle response from justaname
        if (
            data?.result?.data?.subnames &&
            Array.isArray(data.result.data.subnames) &&
            data.result.data.subnames.length > 0
        ) {
            // get the first subname
            const firstSubname = data.result.data.subnames[0]
            if (firstSubname.ens) {
                return firstSubname.ens
            }
        }

        return null
    } catch (error) {
        console.error('Error resolving ENS name:', error)
        return null
    }
}

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

    // resolve to ENS name if possible
    const ensName = await resolveAddress(address)

    return new ImageResponse(
        (
            <LinkPreviewImg
                amount={amount}
                tokenSymbol={tokenSymbol}
                address={ensName || address}
                previewType={previewType}
            />
        ),
        {
            width: 400,
            height: 200,
        }
    )
}

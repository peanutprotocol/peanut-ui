import { ImageResponse } from 'next/og'
import { PaymentCardOG } from '@/components/og/PaymentCardOG'
import { NextResponse, type NextRequest } from 'next/server'
import { PaymentLink } from '@/interfaces'
import { promises as fs } from 'fs'
import path from 'path'
import { BASE_URL } from '@/constants'
import getOrigin from '@/lib/hosting/get-origin'
import { ReceiptCardOG } from '@/components/og/ReceiptCardOG'
import { printableAddress } from '@/utils'
import { isAddress } from 'viem'

export const runtime = 'nodejs' //node.js instead of edge!

// utility function to resolve ENS name from an address
async function resolveAddressToENS(address: string): Promise<string | null> {
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

// utility function to clean up username display
function formatUsernameForDisplay(username: string): string {
    // if it's an ENS name ending with .peanut.me, strip that part
    if (username.endsWith('.peanut.me')) {
        return username.replace('.peanut.me', '')
    }

    // if it's too long and looks like an address, make it printable
    if (username.length > 12) {
        return printableAddress(username)
    }

    return username
}

// loads a font once and keeps it cached in the module
const fontDir = path.join(process.cwd(), 'src', 'assets', 'fonts')
const getFont = async (file: string) => {
    try {
        return await fs.readFile(path.join(fontDir, file))
    } catch (err) {
        console.error(`Failed to load font "${file}":`, err)
        throw new Error(`Font file "${file}" could not be loaded`)
    }
}

export async function GET(req: NextRequest) {
    // grab the full origin (protocol + host + port)
    const origin = (await getOrigin()) || BASE_URL

    // fetch the four fonts in parallel
    let knerdFilled, knerdOutline, montserratMedium, montserratSemibold
    try {
        ;[knerdFilled, knerdOutline, montserratMedium, montserratSemibold] = await Promise.all([
            getFont('knerd-filled.ttf'),
            getFont('knerd-outline.ttf'),
            getFont('montserrat-medium.ttf'),
            getFont('montserrat-semibold.ttf'),
        ])
    } catch (err) {
        console.error('Error loading fonts for OG image:', err)
        return new NextResponse('Internal Server Error', { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const typeParam = searchParams.get('type') ?? 'generic' // validate the type to catch errors
    const type = ['send', 'request', 'generic'].includes(typeParam)
        ? (typeParam as 'send' | 'request' | 'generic')
        : 'generic'

    let username = searchParams.get('username') || 'someone'
    const amount = Number(searchParams.get('amount') ?? 0)
    const token = searchParams.get('token') || null
    const isReceipt = searchParams.get('isReceipt') || 'false'

    if (type === 'generic') {
        return new ImageResponse(<div style={{}}>Peanut Protocol</div>, {
            width: 1200,
            height: 630,
            fonts: [{ name: 'Montserrat', data: montserratMedium, style: 'normal' }],
        })
    }

    // for send/claim links, try to resolve ENS name if username is an address
    if (type === 'send' && isAddress(username)) {
        const ensName = await resolveAddressToENS(username)
        if (ensName) {
            username = ensName // Use the resolved ENS name
        }
    }

    // format username for display (handles .peanut.me cleanup and address formatting)
    username = formatUsernameForDisplay(username)

    if (isReceipt === 'true') {
        const link: PaymentLink & { token?: string } = {
            type,
            username,
            amount,
            status: 'unclaimed',
            token: token || undefined,
        }
        return new ImageResponse(
            (
                <ReceiptCardOG
                    link={link}
                    iconSrc={`${origin}/icons/peanut-icon.svg`}
                    logoSrc={`${origin}/logos/peanut-logo.svg`}
                    scribbleSrc={`${origin}/scribble.svg`}
                />
            ),
            {
                width: 1200,
                height: 630,
                fonts: [
                    { name: 'Knerd Filled', data: knerdFilled, style: 'normal' },
                    { name: 'Knerd Outline', data: knerdOutline, style: 'normal' },
                    { name: 'Montserrat Medium', data: montserratMedium, style: 'normal' },
                    { name: 'Montserrat SemiBold', data: montserratSemibold, style: 'normal' },
                ],
            }
        )
    }

    // create an object with all arrow SVG paths
    const arrowSrcs = {
        topLeft: `${origin}/arrows/top-left-arrows.svg`,
        topRight: `${origin}/arrows/top-right-arrow.svg`,
        bottomLeft: `${origin}/arrows/bottom-left-arrow.svg`,
        bottomRight: `${origin}/arrows/bottom-right-arrow.svg`,
    }

    const link: PaymentLink & { token?: string } = {
        type,
        username,
        amount,
        status: 'unclaimed',
        token: token || undefined,
    }
    return new ImageResponse(
        (
            <PaymentCardOG
                link={link}
                iconSrc={`${origin}/icons/peanut-icon.svg`}
                logoSrc={`${origin}/logos/peanut-logo.svg`}
                scribbleSrc={`${origin}/scribble.svg`}
                arrowSrcs={arrowSrcs}
            />
        ),
        {
            width: 1200,
            height: 630,
            fonts: [
                { name: 'Knerd Filled', data: knerdFilled, style: 'normal' },
                { name: 'Knerd Outline', data: knerdOutline, style: 'normal' },
                { name: 'Montserrat Medium', data: montserratMedium, style: 'normal' },
                { name: 'Montserrat SemiBold', data: montserratSemibold, style: 'normal' },
            ],
        }
    )
}

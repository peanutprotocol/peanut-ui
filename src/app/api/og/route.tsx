import { ImageResponse } from 'next/og'
import { PaymentCardOG } from '@/components/og/PaymentCardOG'
import { NextResponse, type NextRequest } from 'next/server'
import { type PaymentLink } from '@/interfaces/interfaces'
import { promises as fs } from 'fs'
import path from 'path'
import getOrigin from '@/lib/hosting/get-origin'
import { ReceiptCardOG } from '@/components/og/ReceiptCardOG'
import { printableAddress } from '@/utils/general.utils'
import { resolveAddressToUsername } from '@/utils/ens.utils'
import { isAddress } from 'viem'
import { ProfileCardOG } from '@/components/og/ProfileCardOG'
import { InviteCardOG } from '@/components/og/InviteCardOG'
import { BASE_URL } from '@/constants/general.consts'

export const runtime = 'nodejs' //node.js instead of edge!

// utility function to clean up username display
function formatUsernameForDisplay(username: string): string {
    // if it's an ENS name ending with .peanut.me, strip that part
    if (username.endsWith('.peanut.me')) {
        return username.replace('.peanut.me', '')
    }

    // if it's too long and looks like an address, make it printable (6 first, 4 last chars)
    if (username.length > 12) {
        return printableAddress(username, 6, 4)
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

// the brand masters are read from disk and inlined, so the card does not
// depend on a public/ copy being served
const brandDir = path.join(process.cwd(), 'src', 'assets', 'brand')
const getSvgDataUri = async (file: string) => {
    const svg = await fs.readFile(path.join(brandDir, file), 'utf-8')
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export async function GET(req: NextRequest) {
    // grab the full origin (protocol + host + port)
    const origin = (await getOrigin()) || BASE_URL

    // fetch the four fonts and the wordmark in parallel
    let knerdFilled, knerdOutline, montserratMedium, montserratSemibold, wordmark
    try {
        ;[knerdFilled, knerdOutline, montserratMedium, montserratSemibold, wordmark] = await Promise.all([
            getFont('knerd-filled.ttf'),
            getFont('knerd-outline.ttf'),
            getFont('montserrat-medium.ttf'),
            getFont('montserrat-semibold.ttf'),
            getSvgDataUri('wordmark.svg'),
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
    const isPeanutUsername = searchParams.get('isPeanutUsername') || 'false'
    const isInvite = searchParams.get('isInvite') || 'false'

    // create an object with all arrow SVG paths
    const arrowSrcs = {
        topLeft: `${origin}/arrows/top-left-arrows.svg`,
        topRight: `${origin}/arrows/top-right-arrow.svg`,
        bottomLeft: `${origin}/arrows/bottom-left-arrow.svg`,
        bottomRight: `${origin}/arrows/bottom-right-arrow.svg`,
        topRight2: `${origin}/arrows/top-right-arrow-2.svg`,
    }

    if (isInvite === 'true') {
        return new ImageResponse(
            <InviteCardOG
                username={username}
                scribbleSrc={`${origin}/scribble.svg`}
                iconSrc={`${origin}/icons/peanut-icon.svg`}
                logoSrc={wordmark}
                arrowSrcs={arrowSrcs}
            />,
            {
                width: 1200,
                height: 630,
                fonts: [
                    { name: 'Montserrat Medium', data: montserratMedium, style: 'normal' },
                    { name: 'Montserrat SemiBold', data: montserratSemibold, style: 'normal' },
                ],
            }
        )
    }

    if (type === 'generic') {
        return new ImageResponse(<div style={{}}>Peanut</div>, {
            width: 1200,
            height: 630,
            fonts: [{ name: 'Montserrat', data: montserratMedium, style: 'normal' }],
        })
    }

    // for send/claim links, try to resolve ENS name if username is an address
    if (type === 'send' && isAddress(username)) {
        const ensName = await resolveAddressToUsername(username, origin)
        if (ensName) {
            username = ensName // Use the resolved ENS name
        }
    }

    // format username for display (handles .peanut.me cleanup and address formatting)
    username = formatUsernameForDisplay(username)

    if (isPeanutUsername === 'true' && isReceipt === 'false') {
        return new ImageResponse(
            <ProfileCardOG
                username={username}
                scribbleSrc={`${origin}/scribble.svg`}
                logoSrc={wordmark}
                iconSrc={`${origin}/icons/peanut-icon.svg`}
            />,
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
    if (isReceipt === 'true') {
        const link: PaymentLink & { token?: string } = {
            type,
            username,
            amount,
            status: 'unclaimed',
            token: token || undefined,
        }
        return new ImageResponse(
            <ReceiptCardOG
                link={link}
                iconSrc={`${origin}/icons/peanut-icon.svg`}
                logoSrc={wordmark}
                scribbleSrc={`${origin}/scribble.svg`}
                arrowSrcs={arrowSrcs}
            />,
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

    const link: PaymentLink & { token?: string } = {
        type,
        username,
        amount,
        status: 'unclaimed',
        token: token || undefined,
    }
    return new ImageResponse(
        <PaymentCardOG
            link={link}
            iconSrc={`${origin}/icons/peanut-icon.svg`}
            logoSrc={wordmark}
            scribbleSrc={`${origin}/scribble.svg`}
            arrowSrcs={arrowSrcs}
        />,
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

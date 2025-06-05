import { ImageResponse } from '@vercel/og'
import { PaymentCardOG } from '@/components/og/PaymentCardOG'
import type { NextRequest } from 'next/server'
import { PaymentLink } from '@/interfaces'
import { promises as fs } from 'fs'
import path from 'path'
import { BASE_URL } from '@/constants'
import getOrigin from '@/lib/hosting/get-origin'

export const runtime = 'nodejs' //node.js instead of edge!

// loads a font once and keeps it cached in the module
const fontDir = path.join(process.cwd(), 'src', 'assets', 'fonts')
const getFont = (file: string) => fs.readFile(path.join(fontDir, file))

export async function GET(req: NextRequest) {
    // grab the full origin (protocol + host + port)
    const origin = await getOrigin() || BASE_URL

    // fetch the four fonts in parallel
    const [knerdFilled, knerdOutline, montserratMedium, montserratSemibold] = await Promise.all([
        getFont('knerd-filled.ttf'),
        getFont('knerd-outline.ttf'),
        getFont('montserrat-medium.ttf'),
        getFont('montserrat-semibold.ttf'),
    ])

    const { searchParams } = new URL(req.url)
    const type = (searchParams.get('type') ?? 'generic') as 'send' | 'request' | 'generic'
    const username = searchParams.get('username') ?? 'Peanut'
    const amount = Number(searchParams.get('amount') ?? 0)

    if (type === 'generic') {
        return new ImageResponse(<div style={{}}>Peanut Protocol</div>, {
            width: 1200,
            height: 630,
            fonts: [{ name: 'Montserrat', data: montserratMedium, style: 'normal' }],
        })
    }

    // create an object with all arrow SVG paths
    const arrowSrcs = {
        topLeft: `${origin}/arrows/top-left-arrows.svg`,
        topRight: `${origin}/arrows/top-right-arrow.svg`,
        bottomLeft: `${origin}/arrows/bottom-left-arrow.svg`,
        bottomRight: `${origin}/arrows/bottom-right-arrow.svg`
    }

    const link: PaymentLink = { type, username, amount, status: 'unclaimed' }
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

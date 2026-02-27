import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'

const fontDir = path.join(process.cwd(), 'src', 'assets', 'fonts')
const getFont = async (file: string) => fs.readFile(path.join(fontDir, file))

export async function GET(req: NextRequest) {
    const origin = new URL(req.url).origin
    const { searchParams } = new URL(req.url)
    const title = searchParams.get('title') ?? 'Peanut'
    const subtitle = searchParams.get('subtitle') ?? ''

    const [medium, semibold] = await Promise.all([getFont('montserrat-medium.ttf'), getFont('montserrat-semibold.ttf')])

    // Scale title font size down for longer text to prevent overflow
    const titleFontSize = title.length > 50 ? 44 : title.length > 35 ? 54 : 64

    return new ImageResponse(
        <div
            style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                width: 1200,
                height: 630,
                backgroundColor: '#fe91e6',
                border: '3px solid #000',
                padding: '80px 80px 60px',
                color: '#000',
                fontFamily: 'Montserrat',
            }}
        >
            {/* Logo top-left */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 40,
                }}
            >
                <img src={`${origin}/icons/peanut-icon.svg`} width={36} height={46} alt="" />
                <img src={`${origin}/logos/peanut-logo.svg`} width={132} height={26} alt="" />
            </div>

            {/* Title */}
            <div
                style={{
                    display: 'flex',
                    flex: 1,
                    flexDirection: 'column',
                    justifyContent: 'center',
                }}
            >
                <h1
                    style={{
                        fontWeight: 600,
                        fontSize: titleFontSize,
                        lineHeight: 1.15,
                        letterSpacing: '-0.03em',
                        margin: 0,
                        maxWidth: 900,
                    }}
                >
                    {title}
                </h1>

                {subtitle && (
                    <p
                        style={{
                            fontWeight: 400,
                            fontSize: 28,
                            margin: 0,
                            marginTop: 20,
                            maxWidth: 800,
                            lineHeight: 1.4,
                            opacity: 0.7,
                        }}
                    >
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Bottom tagline */}
            <p
                style={{
                    fontWeight: 400,
                    fontSize: 18,
                    margin: 0,
                    opacity: 0.4,
                }}
            >
                peanut.me — Instant global payments in digital dollars
            </p>
        </div>,
        {
            width: 1200,
            height: 630,
            fonts: [
                { name: 'Montserrat', data: medium, style: 'normal', weight: 400 },
                { name: 'Montserrat', data: semibold, style: 'normal', weight: 600 },
            ],
        }
    )
}

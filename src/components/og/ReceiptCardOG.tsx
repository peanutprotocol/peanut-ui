import { type PaymentLink } from '@/interfaces'

function usernamePxWidth(name: string) {
    const charPx = 0.6 * 80 // ≈48 px per glyph
    return Math.round(name.length * charPx) + 40 // +40 padding
}

function formatTokenAmount(amount: string, token?: string) {
    return token && token.toLowerCase() !== 'usdc' ? `${amount} ${token}` : `$${amount}`
}

export function ReceiptCardOG({
    link,
    iconSrc,
    logoSrc,
    scribbleSrc,
    arrowSrcs,
}: {
    link: PaymentLink & { token?: string }
    iconSrc: string
    logoSrc: string
    scribbleSrc: string
    arrowSrcs?: {
        topLeft: string
        topRight: string
        bottomLeft: string
        bottomRight: string
    }
}) {
    /* ----- palette ----- */
    const pink = '#fe91e6'
    const scribbleWidth = usernamePxWidth(link.username)

    /* ----- outer white frame ----- */
    return (
        <div
            style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                width: 1200,
                height: 630,
                border: '3px solid #000',
                backgroundColor: pink,
                padding: 48,
                color: '#000',
            }}
        >
            {/* Receipt for text */}
            <p
                style={{
                    fontFamily: 'Montserrat Medium',
                    fontWeight: 500,
                    fontSize: 60,
                    margin: 0,
                    marginTop: 10,
                    marginBottom: 20,
                    letterSpacing: '-0.03em',
                }}
            >
                Receipt for
            </p>

            {/* Big amount display with knerd fonts and arrows */}
            {link.amount > 0 && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '100%',
                        marginTop: 80,
                        marginBottom: 40,
                        marginLeft: -50, // More centered but still slightly to the left
                    }}
                >
                    <p
                        style={{
                            position: 'relative',
                            display: 'block',
                            fontSize: 250,
                            lineHeight: 1,
                            margin: 0,
                        }}
                    >
                        {/* Top-left arrow */}
                        {arrowSrcs && (
                            <img
                                src={arrowSrcs.topLeft}
                                width={100}
                                height={100}
                                alt=""
                                style={{
                                    position: 'absolute',
                                    top: -110,
                                    left: -60,
                                    pointerEvents: 'none',
                                }}
                            />
                        )}

                        {/* Top-right arrow */}
                        {arrowSrcs && (
                            <img
                                src={arrowSrcs.topRight}
                                width={130}
                                height={80}
                                alt=""
                                style={{
                                    position: 'absolute',
                                    top: -90,
                                    right: -100,
                                    pointerEvents: 'none',
                                    transform: 'rotate(5deg)',
                                }}
                            />
                        )}

                        {/* White fill */}
                        <span
                            style={{
                                fontFamily: 'Knerd Filled',
                                color: '#fff',
                                letterSpacing: '-0.08em',
                            }}
                        >
                            {formatTokenAmount(link.amount.toString(), link.token)}
                        </span>

                        {/* Black outline */}
                        <span
                            aria-hidden="true"
                            style={{
                                position: 'absolute',
                                top: 3,
                                left: 3,
                                fontFamily: 'Knerd Outline',
                                color: '#000',
                                pointerEvents: 'none',
                                transformOrigin: 'top left',
                                transform: 'scaleX(1.01) scaleY(1.01)',
                                letterSpacing: '-0.08em',
                            }}
                        >
                            {formatTokenAmount(link.amount.toString(), link.token)}
                        </span>

                        {/* Bottom-left arrow */}
                        {arrowSrcs && (
                            <img
                                src={arrowSrcs.bottomLeft}
                                width={64}
                                height={96}
                                alt=""
                                style={{
                                    position: 'absolute',
                                    bottom: 10,
                                    left: -20,
                                    pointerEvents: 'none',
                                }}
                            />
                        )}

                        {/* Bottom-right arrow */}
                        {arrowSrcs && (
                            <img
                                src={arrowSrcs.bottomRight}
                                width={40}
                                height={60}
                                alt=""
                                style={{
                                    position: 'absolute',
                                    bottom: 10,
                                    right: -20,
                                    pointerEvents: 'none',
                                    transform: 'rotate(-15deg)',
                                }}
                            />
                        )}
                    </p>
                </div>
            )}

            {/* Sent via text with inline logo */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginTop: 10,
                }}
            >
                <p
                    style={{
                        fontFamily: 'Montserrat Medium',
                        fontWeight: 500,
                        fontSize: 56,
                        margin: 0,
                        letterSpacing: '-0.03em',
                    }}
                >
                    sent via
                </p>
                <img src={iconSrc} width={42} height={54} alt="Peanut icon" />
                <img src={logoSrc} width={158} height={32} alt="Peanut logo" />
            </div>
        </div>
    )
}

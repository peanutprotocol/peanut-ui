import { PaymentLink } from '@/interfaces'

function usernamePxWidth(name: string) {
    const charPx = 0.6 * 80 // ≈48 px per glyph
    return Math.round(name.length * charPx) + 40 // +40 padding
}

export function ReceiptCardOG({
    link,
    iconSrc,
    logoSrc,
    scribbleSrc,
}: {
    link: PaymentLink
    iconSrc: string
    logoSrc: string
    scribbleSrc: string
}) {
    /* ----- palette ----- */
    const pink = '#fe91e6'
    const scribbleWidth = usernamePxWidth(link.username)

    /* ----- outer white frame ----- */
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                padding: 16,
                width: 1200,
                height: 630,
            }}
        >
            {/* inner coloured card ---------------------------------------- */}
            <div
                style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 16,
                    width: '100%',
                    border: '3px solid #000',
                    backgroundColor: pink,
                    padding: 48,
                    color: '#000',
                }}
            >
                {/*  logo top-left  */}
                <div
                    style={{
                        position: 'absolute',
                        top: 24,
                        left: 34,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <img src={iconSrc} width={36} height={46} alt="Peanut icon" />
                    <img src={logoSrc} width={132} height={26} alt="Peanut logo" />
                </div>

                {/*  username  */}
                <div
                    style={{
                        position: 'relative',
                        display: 'flex', // ← now it’s explicit flex
                        flexDirection: 'column', // stack H2 then IMG
                        alignItems: 'center', // center them horizontally
                        marginBottom: 8,
                        width: '100%',
                    }}
                >
                    {/* 1) the username in flow */}
                    <h2
                        style={{
                            fontFamily: 'Montserrat SemiBold',
                            fontWeight: 700,
                            fontSize: 80,
                            margin: 0,
                            letterSpacing: '-0.05em',
                        }}
                    >
                        {link.username}
                    </h2>

                    {/* 2) the scribble on top, absolutely positioned */}
                    <img
                        src={scribbleSrc}
                        width={scribbleWidth}
                        height={130}
                        alt=""
                        style={{
                            position: 'absolute',
                            top: -20,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            pointerEvents: 'none',
                        }}
                    />
                </div>
                {/*  action text  */}
                <p
                    style={{
                        fontFamily: 'Montserrat Medium',
                        fontWeight: 500,
                        fontSize: 80,
                        margin: 0,
                        marginTop: 60,
                        letterSpacing: '-0.03em',
                    }}
                >
                    sent you a receipt
                </p>
            </div>
        </div>
    )
}

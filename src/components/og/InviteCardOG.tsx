function usernamePxWidth(name: string) {
    const charPx = 0.6 * 80 // ≈48 px per glyph
    return Math.round(name.length * charPx) + 40 // +40 padding
}

export function InviteCardOG({
    username,
    scribbleSrc,
    iconSrc,
    logoSrc,
    arrowSrcs,
}: {
    username: string
    scribbleSrc: string
    iconSrc: string
    logoSrc: string
    arrowSrcs?: {
        topLeft: string
        topRight2: string
    }
}) {
    /* ----- palette ----- */
    const pink = '#fe91e6'
    const scribbleWidth = usernamePxWidth(username)
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
                    {username}
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
                    fontSize: 46,
                    margin: 0,
                    marginTop: 10,
                    marginBottom: 16,
                    letterSpacing: '-0.03em',
                }}
            >
                is inviting you to join
            </p>

            <div
                style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    margin: 'auto',
                }}
            >
                {/* Top-left arrow */}
                {arrowSrcs && (
                    <img
                        src={arrowSrcs.topLeft}
                        width={130}
                        height={130}
                        alt=""
                        style={{
                            position: 'absolute',
                            top: -70,
                            left: -120,
                            pointerEvents: 'none',
                        }}
                    />
                )}

                {/* Top-right arrow */}
                {arrowSrcs && (
                    <img
                        src={arrowSrcs.topRight2}
                        width={130}
                        height={130}
                        alt=""
                        style={{
                            position: 'absolute',
                            top: -70,
                            right: -150,
                            pointerEvents: 'none',
                            transform: 'rotate(5deg)',
                        }}
                    />
                )}
                <img src={iconSrc} width={180} height={230} alt="Peanut icon" />
                <img src={logoSrc} width={500} height={124} style={{ marginLeft: 20 }} alt="Peanut logo" />
            </div>
        </div>
    )
}

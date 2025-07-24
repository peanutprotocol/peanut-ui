const usernameFontSize = 150
function usernamePxWidth(name: string) {
    const charPx = 0.6 * usernameFontSize // ≈48 px per glyph
    return Math.round(name.length * charPx) + 40 // +40 padding
}

export function ProfileCardOG({
    username,
    scribbleSrc,
    logoSrc,
    iconSrc,
}: {
    username: string
    scribbleSrc: string
    logoSrc: string
    iconSrc: string
}) {
    const pink = '#fe91e6'
    const scribbleWidth = usernamePxWidth(username)
    return (
        /* ----- outer white frame ----- */
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
                    justifyContent: 'center',
                    gap: 50,
                    width: '100%',
                    border: '3px solid #000',
                    backgroundColor: pink,
                    padding: 48,
                    color: '#000',
                }}
            >
                <h1 style={{ fontFamily: 'Montserrat Medium', fontWeight: 500, fontSize: 46 }}>
                    Send or Request money
                </h1>
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
                            fontSize: usernameFontSize,
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
                        height={250}
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

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 16,
                    }}
                >
                    <p style={{ fontFamily: 'Montserrat Medium', fontWeight: 500, fontSize: 46 }}>with</p>
                    <img src={iconSrc} width={36} height={46} alt="Peanut logo" />
                    <img src={logoSrc} width={132} height={26} alt="Peanut text" />
                </div>
            </div>
        </div>
    )
}

export type MascotPose =
    /** Both fists up, celebrating — big money wins (claim / payment success, confetti moments). */
    | 'cheering'
    /** Grinning, pointing off-screen. */
    | 'pointing'
    /** Both hands pointing down — marketing CTA. */
    | 'pointing-down'
    /** Slumped, frowning, hands on hips — sad / dejected (errors). */
    | 'sad'
    /** Pondering — loading / verification waits. */
    | 'thinking'
    /** Pixel shades, hand on hip, big grin — confident "too cool" flex. */
    | 'too-cool'
    /** Mid-stride, arms swinging — physical-card waitlist ("on the way / shipping"). */
    | 'walking'
    /** Peace-sign, mid-stride — chill / effortless: landing hero, setup intro, low-key wins. */
    | 'waving-chill'
    /** One arm up, waving — greetings / setup. */
    | 'waving-hello'
    /** Hands to face, fretting — errors / empty states. */
    | 'worried'

/** Bounding box of the drawn artwork inside the comp canvas, in viewBox units. */
export type MascotArtBox = {
    x: number
    y: number
    w: number
    h: number
}

/** Where to put the comp canvas inside the host box, in CSS pixels. */
export type MascotPlacement = {
    width: number
    height: number
    left: number
    top: number
}

export type PeanutMascotProps = {
    pose: MascotPose
    /** Sizing lives here — the mascot fills whatever box the classes give it. */
    className?: string
    /** Empty or omitted makes the mascot decorative (aria-hidden); text makes it role="img". */
    alt?: string
    loop?: boolean
}

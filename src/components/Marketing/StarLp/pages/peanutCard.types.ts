import type { ReactNode } from 'react'

export interface PeanutCardTerminalProps {
    /** The reader shows its green "Approved" once the phone has tapped. */
    approved: boolean
    /** The phone is on the reader right now: the light, the ring burst and the nudge play on contact. */
    tapping: boolean
    /** Changes on every tap, so the ring burst restarts. */
    tapId: number
    /** The story is over and the visitor has not tapped yet: the reader pings to invite a tap. */
    inviting: boolean
}

export interface PeanutCardWalletScreenProps {
    /** The reader approved: the contactless glyph turns into a check. */
    approved: boolean
}

export interface PeanutCardContactlessProps {
    className?: string
}

export type PeanutCardCtaPlacement = 'hero' | 'hero-card' | 'close'

export interface PeanutCardCtaProps {
    /** Where the CTA sits. Only the hero counts the store-handoff impression, so a page view counts once. */
    placement: Exclude<PeanutCardCtaPlacement, 'hero-card'>
}

export interface PeanutCardHeroFaceProps {
    /** The hero card is a link: on press the face slides onto its offset shadow. */
    pressable?: boolean
}

export interface PeanutCardRiseProps {
    children?: ReactNode
    /** Seconds after the element is in view. */
    delay: number
    /** `rise` lifts the children 10px into place; `rule` draws a 2px line left to right. */
    variant: 'rise' | 'rule'
    className?: string
}

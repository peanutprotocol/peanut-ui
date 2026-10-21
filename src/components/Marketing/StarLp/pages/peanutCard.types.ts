import type { ReactNode } from 'react'

export interface PeanutCardReceiptFoldProps {
    /** Section title, e.g. "See every spend." */
    title: string
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

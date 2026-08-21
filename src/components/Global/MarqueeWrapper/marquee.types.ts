/**
 * A marquee word that carries a link. Items given as plain strings stay
 * unlinked, so every existing caller keeps working untouched.
 */
export interface MarqueeLink {
    label: string
    href: string
}

export type MarqueeItem = string | MarqueeLink

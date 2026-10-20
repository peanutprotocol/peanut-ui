import type { ReactNode } from 'react'

/** The marketing band grounds the six star LPs use (design.md § grounds). */
export type BandGround = 'pink' | 'cream' | 'sky' | 'yellow' | 'black' | 'white'

/** design.md § layout: 1280 landing · 720 hub · 640 prose. */
export type BandWidth = 'landing' | 'hub' | 'prose'

export interface BandProps {
    ground: BandGround
    /** Inner column width; `landing` by default. */
    width?: BandWidth
    /** `center` centres the text in the column. */
    align?: 'start' | 'center'
    id?: string
    className?: string
    /** Accessible name for a band that has no heading of its own. */
    label?: string
    children: ReactNode
}

/** `fold` (default): sentence-length fold h2s, one step under the hero. `display`: a one-line title that may go big. */
export type SectionTitleSize = 'fold' | 'display'

export interface SectionTitleProps {
    children: ReactNode
    size?: SectionTitleSize
    className?: string
}

/** Knerd `Title` size presets. Call sites never pass their own size. */
export type KnerdSize = 'hero' | 'compact' | 'inline'

export interface KnerdTitleProps {
    /** Caps are applied for you. Break lines with "\n". 1–3 words. */
    text: string
    size: KnerdSize
    className?: string
}

/** A Roboto display line next to a knerd Title (e.g. "GET PAID FROM"). */
export type DisplayLineSize = 'lead' | 'section'

export interface DisplayLineProps {
    children: ReactNode
    size?: DisplayLineSize
    className?: string
}

export interface StarLpHeroProps {
    /** h1 content: DisplayLine and/or KnerdTitle nodes. */
    title: ReactNode
    /** The one descriptive line under the h1. */
    subtitle?: string
    /** A StarLpCta (white secondary: the hero is pink). */
    cta: ReactNode
    /** Drawn product UI or an approved card face. */
    art: ReactNode
    /** Short description of the art for screen readers (role="img"). Omit and
        the drawn UI is hidden from them: the h1 and subtitle carry the message. */
    artLabel?: string
}

export interface StarLpCtaProps {
    /** Destination when the PWA-sunset flag is off. With the flag on every CTA goes to /app. */
    href: string
    /** Where a signed-in visitor goes instead (e.g. '/card'). Omit to use `href` for everyone. */
    signedInHref?: string
    /** The ground the button sits on: picks the DS variant (white on colour, pink on cream/black/white). */
    ground: BandGround
    /** Sentence-case label. */
    children: ReactNode
}

export interface PhoneFrameProps {
    children: ReactNode
    /** Resting tilt in degrees. */
    tilt?: number
    /** Ground of the screen; cream by default. */
    screen?: 'cream' | 'white'
    className?: string
    /** Short description for screen readers (role="img"). Omit and the drawn
        screen is hidden from them, since its text is illustrative. */
    label?: string
}

export type ChatSide = 'them' | 'me'

export interface ChatBubbleProps {
    side: ChatSide
    /** Sender name shown on a `them` bubble. */
    author?: string
    /** Small time stamp, e.g. "10:15". */
    time?: string
    children: ReactNode
}

export interface LinkPreviewBubbleProps {
    /** Line above the amount, e.g. "valentina is requesting". */
    caption: string
    /** Knerd amount, e.g. "$250". */
    amount: string
    /** Link text in the real request-link shape (getRequestLink), e.g. "peanut.me/valentina/…". */
    url: string
    side?: ChatSide
}

export interface StarLpFaqItem {
    id: string
    question: string
    answer: string
}

export interface StarLpFaqProps {
    items: StarLpFaqItem[]
    /** Legal line under the list (e.g. "Peanut is not a bank."). Only lines product/ or a partner rule requires. */
    footnote?: string
}

export interface TrustBandProps {
    /** One line. Use "\n" for the phone line break. */
    text: string
}

export interface CloseFoldProps {
    /** Knerd lockup, 1–3 words, "\n" between lines. */
    title: string
    /** One short Roboto line under the title. */
    line?: string
    /** A StarLpCta whose `ground` matches this fold. */
    cta: ReactNode
    ground?: BandGround
    /** Replaces the default two sparkles (approved doodles only). */
    decoration?: ReactNode
}

export interface StarLpPageProps {
    children: ReactNode
    /** false drops the footer's site directory (its "Send to Argentina"-style
        links). The card page sets it: Rain §7/§11 bar country-named links there. */
    siteDirectory?: boolean
}

export interface StarLpMetadataInput {
    title: string
    description: string
    /** Route path, e.g. '/peanut-card'. */
    path: string
    /**
     * Headline on the generated OG card. Defaults to `title` without its
     * ' | Peanut' suffix, since the card already shows the logo.
     */
    ogTitle?: string
    /** Subtitle on the generated OG card. */
    ogSubtitle?: string
}

/* ── animation kit ── */

export interface PopInProps {
    children: ReactNode
    /** Seconds after the element enters the viewport. Stagger siblings by 0.08–0.15. */
    delay?: number
    /** Resting tilt in degrees; the element lands on it from a little further. */
    tilt?: number
    className?: string
}

export interface DropInProps {
    children: ReactNode
    delay?: number
    /** Tilt it falls from, degrees (Split uses −14, 12, −8). */
    fromTilt?: number
    /** Tilt it rests at, degrees. */
    tilt?: number
    className?: string
}

export type WiggleKind = 'wobble' | 'bounce'

export interface WiggleProps {
    children: ReactNode
    /** wobble: slow ±3° sticker rock. bounce: a hop every few seconds (gloves). */
    kind: WiggleKind
    /** Seconds; offsets two wiggles so they do not move in sync. */
    delay?: number
    className?: string
}

export interface StorySequenceProps {
    /** Rendered in order; each beat appears `stepMs` after the previous one. */
    beats: ReactNode[]
    stepMs?: number
    className?: string
    beatClassName?: string
}

export interface EntranceArmState {
    /** Attach to the animated element. */
    ref: (node: HTMLElement | null) => void
    /** true once the element is known to start below the viewport and motion is allowed. */
    armed: boolean
}

export interface StoryStepState {
    /** Attach to the element whose entry into view starts the story. */
    ref: (node: HTMLElement | null) => void
    /** How many beats are visible. Equals `count` when the story is complete or motion is off. */
    step: number
    /** Show every beat now. A no-op unless the story is running; call it from onClick, not onPointerDown, so a scroll swipe does not count. */
    complete: () => void
}

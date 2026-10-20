import type { ReactNode } from 'react'
import type { MarqueeItem } from '@/components/Global/MarqueeWrapper/marquee.types'

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
    /** Line above the amount, e.g. "fulano is requesting". */
    caption: string
    /** Knerd amount, e.g. "$250". */
    amount: string
    /** Link text in the real request-link shape (getRequestLink), e.g. "peanut.me/fulano/…". */
    url: string
    side?: ChatSide
}

export interface StarLpFaqItem {
    id: string
    question: string
    /** Plain text: the FAQPage JSON-LD answer, and the shown answer unless answerContent is set. */
    answer: string
    /** Shown instead of `answer`, e.g. the same words with in-text links (FAQsPanel's answerContent). */
    answerContent?: ReactNode
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

/** The three coloured grounds. A seam with one of them on either side gets a marquee. */
export type ColouredGround = Extract<BandGround, 'pink' | 'sky' | 'yellow'>

/** Strip colours: the coloured grounds plus white (cream counts as white). */
export type MarqueeStripGround = ColouredGround | 'white'

export interface StarLpMarqueeProps {
    /** Real product words for this page. Plain strings, or `{ label, href }` for a word that links somewhere real. */
    words: MarqueeItem[]
    /** The folds above and below the strip, in page order (the footer is black). At least one is coloured. */
    between: readonly [BandGround, BandGround]
    /** Strip colour. Defaults to the first of yellow, sky, pink, white that neither neighbour has. */
    ground?: MarqueeStripGround
}

/** Pages that carry a scannable QR. Used as `utm_campaign`. */
export type StarLpQrCampaign = 'qr-argentina' | 'qr-brazil'

/** Where the QR sits on the page. Used as `utm_content`. */
export type StarLpQrSlot = 'hero-sticker' | 'close-sticker' | 'ways-in'

export interface StarLpQrCodeProps {
    campaign: StarLpQrCampaign
    slot: StarLpQrSlot
    /** Width classes; the code is square and carries its own white quiet zone. */
    className?: string
}

export interface StarLpQrUrlInput {
    /** Origin of the server that rendered the page, so a LAN or preview scan returns to it. */
    origin: string
    /** PWA-sunset flag. On: the native app-entry path. Off: web signup. */
    migrationOn: boolean
    campaign: StarLpQrCampaign
    slot: StarLpQrSlot
}

/** One example person, used the same way on every page. */
export interface StarLpPersona {
    /** Full display name, e.g. "Fulano de Tal". */
    name: string
    /** Chat-bubble and greeting form, e.g. "Fulano". */
    short: string
    /** Avatar initials. */
    initials: string
    /** peanut.me username. Checked unregistered on prod (20 Oct 2026). */
    username: string
}

/** A live indicative rate from the backend's /fx/rate. */
export interface StarLpFxRate {
    from: string
    to: string
    /** Units of `to` per one unit of `from`. */
    rate: number
    /** The provider leg behind the rate (Manteca for ARS/BRL, Bridge for EUR). */
    source: 'bridge' | 'manteca' | 'reference'
    /** Backend `generatedAt`, ISO. */
    fetchedAt: string
}

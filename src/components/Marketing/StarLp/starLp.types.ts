import type { MarketingQrContext } from '@/features/marketing-qr/contract'
import type { ReactNode } from 'react'
import type { StaticImageData } from 'next/image'
import type { TitleMark } from '@/components/0_Bruddle/Title.types'
import type { MarqueeItem } from '@/components/Global/MarqueeWrapper/marquee.types'
import type { MigrationSurface } from '@/constants/migration.consts'

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

/** Knerd `Title` size presets for static Knerd. Call sites never pass their own
    size. The hero's oversized words are KnerdPullHeadline, not a preset. */
export type KnerdSize = 'hero' | 'compact' | 'inline' | 'amount' | 'display'

export interface KnerdTitleProps {
    /** Caps are applied for you. Break lines with "\n". 1–3 words. */
    text: string
    size: KnerdSize
    /** A decoration Title anchors on one word (the close fold's circled word). */
    mark?: TitleMark
}

export interface KnerdPullHeadlineProps {
    /** The phrase, 1–3 words. "\n" marks the stacked lines for 600px and below;
        above 600px the lines join into one wide line. */
    text: string
    /** A small Roboto word inside the phrase that is not Knerd ("and"). */
    join?: string
}

/** A Roboto display line next to a knerd Title (e.g. "GET PAID FROM").
    `masthead` is the hero h1: a plain-text line sizes itself to fill the fold. */
export type DisplayLineSize = 'masthead' | 'lead' | 'section'

export interface DisplayLineProps {
    children: ReactNode
    size?: DisplayLineSize
    className?: string
}

export interface StarLpHeroProps {
    /** The Roboto line of the h1, set over the Knerd's top edge ("No DNI?"). */
    lead: string
    /** The oversized Knerd words, with Follow the pull. "\n" marks the stacked
        lines for 600px and below (public/dev/knerd/data.js). */
    knerd: string
    /** A small Roboto word inside the Knerd phrase ("and"). */
    knerdJoin?: string
    /** A last h1 line ("at the till."). It is set under the art, so the art
        tucks up under the Knerd as on the peanut.me hero. */
    titleTail?: string
    /** The one descriptive line under the h1. */
    subtitle?: string
    /** A StarLpCta (white secondary: the hero is pink). */
    cta: ReactNode
    /** Drawn product UI or an approved card face. */
    art: ReactNode
    /** Short description of the art for screen readers (role="img"). Omit and
        the drawn UI is hidden from them: the h1 and subtitle carry the message. */
    artLabel?: string
    /** `headline` (default): the art tucks up under the Knerd. `edge`: the art
        stands on the hero's bottom edge, cut by it, so it rises out of the
        marquee below. */
    artPlacement?: StarLpHeroArtPlacement
    /** Art under the headline only. `deep` (default): it tucks up under the
        Knerd. `rim`: from md only its top edge meets the Knerd, for art with a
        title bar on top. `none`: it starts below the Knerd, for art with a mark
        in its top corner. */
    artTuck?: StarLpHeroArtTuck
}

export type StarLpHeroArtPlacement = 'headline' | 'edge'

export type StarLpHeroArtTuck = 'deep' | 'rim' | 'none'

export interface StarLpCtaProps {
    qrPlacement?: string
    /** Destination when the PWA-sunset flag is off. With the flag on every CTA goes to /app. */
    href: string
    /** Where a signed-in visitor goes instead (e.g. '/card'). Omit to use `href` for everyone. */
    signedInHref?: string
    /** The ground the button sits on: picks the DS variant (white on colour, pink on cream/black/white). */
    ground: BandGround
    /** Sentence-case label. */
    children: ReactNode
    /** Analytics surface of the click. Star LPs leave it at STAR_LP; another page passes its own. */
    surface?: MigrationSurface
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
    /** The screen holds a real link: the frame is a labelled group, not an
        image, so assistive tech still exposes the link. Needs `label`. */
    interactive?: boolean
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
    /** Knerd amount, e.g. "$250". Left out when there is no figure the page can vouch for. */
    amount?: string
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
    /** A help page under the answer, shown with `learnMoreLabel` (FAQsPanel's learnMoreHref). */
    learnMoreHref?: string
}

export interface StarLpFaqProps {
    items: StarLpFaqItem[]
    /** Legal line under the list (e.g. "Peanut is not a bank."). Only lines product/ or a partner rule requires. */
    footnote?: string
    /** Link text for items that carry `learnMoreHref`, in the page language. */
    learnMoreLabel?: string
    /** Language of the questions, for the FAQPage JSON-LD (e.g. 'es-AR'). Star LPs are English and leave it out. */
    inLanguage?: string
    /** Section id, e.g. 'faq' for an in-page anchor. */
    id?: string
}

export interface TrustBandProps {
    /** One line. Use "\n" for the phone line break. */
    text: string
}

/** The close fold's CTA (a StarLpCta) that the peace glove sits beside. */
export interface CloseGloveCtaProps {
    children: ReactNode
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
    /** One word of `title` to circle with the hand-drawn scribble; its stroke crosses the letters. The circle replaces the default sparkles. */
    circleWord?: string
    /** Band id, e.g. an anchor or an e2e hook. */
    id?: string
}

export interface StarLpPageProps {
    marketingPage?: MarketingQrContext['page']
    children: ReactNode
    /** false drops the footer's site directory (its "Send to Argentina"-style
        links). The card page sets it: Rain §7/§11 bar country-named links there. */
    siteDirectory?: boolean
    /** false drops the footer's language picker (flags, country-named labels).
        The card page sets it: Rain §11 bars flags and selectors there. */
    localeSwitcher?: boolean
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
    /** `span` inside phrasing content (a heading); give it a display class. Default `div`. */
    as?: 'div' | 'span'
}

export interface DropInProps {
    children: ReactNode
    /** A shared motion guard and viewport trigger for a visible, synchronized pop. */
    entrance?: { enabled: boolean; visible: boolean }
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

/** Strip colours: sky, pink or white (cream counts as white). design.md § layout: "the yellow marquee is home-only." */
export type MarqueeStripGround = Exclude<ColouredGround, 'yellow'> | 'white'

export interface StarLpMarqueeProps {
    /** Real product words for this page. Plain strings, or `{ label, href }` for a word that links somewhere real. */
    words: MarqueeItem[]
    /** The folds above and below the strip, in page order (the footer is black). At least one is coloured. */
    between: readonly [BandGround, BandGround]
    /** Strip colour. Defaults to the first of sky, pink, white that neither neighbour has. */
    ground?: MarqueeStripGround
}

/** Pages that carry a scannable QR. Used as `utm_campaign`. */
export type StarLpQrCampaign = 'qr-argentina' | 'qr-brazil'

/** Where the QR sits on the page. Used as `utm_content`. */
export type StarLpQrSlot = 'hero-sticker' | 'close-sticker' | 'ways-in' | 'home-sticker'

export interface StarLpQrCodeProps {
    campaign: StarLpQrCampaign
    slot: StarLpQrSlot
    /** Width classes; the code is square and carries its own white quiet zone. */
    className?: string
    /** The registered marketing QR to show when the PWA sunset is on. Leave it out on the
        star LPs: the code then registers as `{campaign}-{slot}-en`. Another page (home)
        passes its own page, placement and locale; `campaign` and `slot` still tag the
        fallback URL while the sunset is off. */
    qrContext?: MarketingQrContext
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

/** One illustrative earner on the income pages' persona fold: a composite from
    product/icps.md, never a real person. */
export interface StarLpEarner {
    /** Avatar sticker key (avatar.utils), e.g. "basic.flower". */
    avatar: string
    /** Trade and city, e.g. "Brand designer, Buenos Aires". */
    who: string
}

/** An earner's card on one page: their own line and, optionally, one short fact. */
export interface StarLpPersonaCard extends StarLpEarner {
    /** First person, sentence case, one sentence. Not a quote: no quote marks. */
    line: string
    /** The rail that pays them (SEPA, ACH) or where the client pays from. Omit and the card has no pill. */
    tag?: string
}

export interface PersonaFoldProps {
    cards: readonly StarLpPersonaCard[]
    /** The fold's h2, in the page language. Defaults to "Sound like you?". */
    title?: ReactNode
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
    /** Backend `effectiveAt`: when the provider observed the rate, ISO. */
    effectiveAt: string
}

/**
 * How a page may print a rate, by the age of the backend's own timestamps:
 * `live` up to 30 minutes, `lastKnown` up to 12 hours, then `none`.
 */
export type StarLpFxReading = { tier: 'live' | 'lastKnown'; quote: StarLpFxRate } | { tier: 'none'; quote: null }

export interface TillStickerProps {
    /** The rail's mark above the line: a `@/assets/payment-apps` SVG import. */
    mark: StaticImageData
    /** The rail's name, as the mark's alt text. */
    markAlt: string
    /** The sticker's line, in the till's language ("Pagá con QR"). */
    label: string
    /** BCP 47 tag of `label`. */
    lang: string
    campaign: StarLpQrCampaign
    /** Where the sticker sits; tags the QR's utm_content. */
    slot: StarLpQrSlot
    /** Width classes; the sticker scales with its width. */
    className?: string
    /** Load the mark eagerly; set only where the sticker is in the first screen. */
    priority?: boolean
    /** Passed to StarLpQrCode: the registered QR of a page other than the star LPs. */
    qrContext?: MarketingQrContext
}

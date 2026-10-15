// The ratified marketing brand facts (drift-audit; Konrad's rulings of
// 2026-10-14/15). Palette rows name @theme tokens — the page resolves every
// displayed value from tokens.generated, so a swatch cannot drift from
// globals.css. Hex literals appear here only where no token exists yet (the
// brand book's own values in the errata) — this is a data file, not a style.

export interface PaletteEntry {
    label: string
    /** @theme token name, resolved against COLOR_TOKENS for the displayed value */
    token: string
    /** complete class so Tailwind sees it at build time */
    swatchClass: string
    role: string
    /** a swatch that documents a FUTURE state carries the pending note */
    pending?: string
}

export const MARKETING_PALETTE: PaletteEntry[] = [
    {
        label: 'Cream',
        token: 'background-page',
        swatchClass: 'bg-background-page',
        role: 'The page ground. Every marketing page sits on cream, never white (ruled 2026-10-14; brand book shows white).',
    },
    {
        label: 'Pink',
        token: 'background-brand',
        swatchClass: 'bg-background-brand',
        role: 'Brand ground for pink section bands (bg-background-brand) and the primary action (action-primary).',
    },
    {
        label: 'Yellow',
        token: 'action-secondary',
        swatchClass: 'bg-action-secondary',
        role: 'Icon and mascot body colour; the secondary action and the home-only marquee.',
    },
    {
        label: 'Black',
        token: 'border-default',
        swatchClass: 'bg-border-default',
        role: 'Near-black for text and borders. Pure #000 survives only on button borders and shadows — see the border split below.',
    },
    {
        label: 'Lavender',
        token: 'background-setup-hero',
        swatchClass: 'bg-background-setup-hero',
        role: 'Marketing band ground — ruled 2026-10-15. The lavender bands stay; no more raw hex inline.',
        pending:
            'pending: the named marketing band token lands in ds-marketing-tokens — today the value ships as blue-300 / background-setup-hero',
    },
]

export interface RampStep {
    label: string
    /** font size / line height, px — the enforced September ruling */
    sizePx: number
    leadingPx: number
    /** text-<ramp> plus an explicit !leading override (see the page note) */
    className: string
    sample: string
}

/**
 * The ruled display ramp (September ruling, ENFORCED 2026-10-15, Konrad; weight
 * 1000). The @theme tokens already carry this leading — the demo pins it with
 * !leading-N anyway because the unlayered .font-roboto-flex-extrabold class
 * still forces line-height 1.0 at every call site (globals.css ~1355). The
 * leading numbers are spacing steps: 26 = 104px, 16 = 64px, 11.5 = 46px, 9 = 36px.
 */
export const DISPLAY_RAMP: RampStep[] = [
    { label: 'headingLarge', sizePx: 112, leadingPx: 104, className: 'text-headingLarge !leading-26', sample: 'SEND' },
    {
        label: 'headingMedium',
        sizePx: 80,
        leadingPx: 64,
        className: 'text-headingMedium !leading-16',
        sample: 'NO FEES',
    },
    { label: 'heading', sizePx: 60, leadingPx: 46, className: 'text-heading !leading-11.5', sample: 'ENVÍA DÓLARES' },
    {
        label: 'headingSmall',
        sizePx: 42,
        leadingPx: 36,
        className: 'text-headingSmall !leading-9',
        sample: 'ÁGIL É MELHOR',
    },
]

export interface ErrataEntry {
    /** where the brand book says it */
    pdfRef: string
    bookSays: string
    ratified: string
    ruled: string
}

/**
 * Errata against public/press/assets/Peanut_Brand_Guidelines.pdf. Ruling 1:
 * the live site is the brand — the book gets this list, not a redesign.
 */
export const BRAND_BOOK_ERRATA: ErrataEntry[] = [
    {
        pdfRef: 'p.1 vs p.31',
        bookSays: 'Cover reads "VERSION 1.2 / NOVEMBER 2024"; the back page reads "Version 1 – 30.10.2024"',
        ratified: 'The cover label v1.2 is canonical; the back-page label is stale',
        ruled: 'RULED 2026-10-14 (k1)',
    },
    {
        pdfRef: 'p.28',
        bookSays: 'Square corners on buttons, panels and inputs',
        ratified: 'Pill buttons (rounded-full); panels and tiles at rounded-sm = 2px',
        ruled: 'RULED 2026-10-14 (k2)',
    },
    {
        pdfRef: 'p.28',
        bookSays: 'Uniform ~2px pure-black borders',
        ratified:
            'The shipped split: 1px #000000 on buttons (border-button), 2px #161616 elsewhere (border-2 border-default)',
        ruled: 'RULED 2026-10-14 (k3)',
    },
    {
        pdfRef: 'p.18',
        bookSays: 'Body copy in Roboto Flex Regular (400)',
        ratified: 'Marketing body weight is 500 (font-medium)',
        ruled: 'RULED 2026-10-14 (k11 / §3.2)',
    },
    {
        pdfRef: 'pp.2–28',
        bookSays: 'White content surfaces throughout',
        ratified: 'Cream #faf4f0 (background-page) is the page ground',
        ruled: 'RULED 2026-10-14 (k4 / CL15)',
    },
    {
        pdfRef: 'pp.13–14, 25',
        bookSays: 'Lavender is secondary only — a logo background, never a page ground',
        ratified: 'Lavender #90a8ed is a named marketing band ground with usage rules',
        ruled: 'RULED 2026-10-15 (q2 / k12)',
    },
    {
        pdfRef: 'pp.10–12',
        bookSays: 'Mascot in yellow, black and white only, with white sneakers',
        ratified: 'Pink sneakers are canon, consistent across all 10 Lotties',
        ruled: 'RULED 2026-10-14 (k6)',
    },
    {
        pdfRef: 'pp.10, 30',
        bookSays: 'The key visual leads with the walking mascot',
        ratified: 'The shipped animated waving-chill pose stays on the landing hero',
        ruled: 'RULED 2026-10-14 (k7)',
    },
]

// The marketing brand facts. Palette rows name @theme tokens — the page
// resolves every displayed value from tokens.generated, so a swatch cannot
// drift from globals.css. Hex literals appear here only where no token exists
// (the brand book's own values in the errata) — this is a data file, not a style.

export interface PaletteEntry {
    label: string
    /** @theme token name, resolved against COLOR_TOKENS for the displayed value */
    token: string
    /** complete class so Tailwind sees it at build time */
    swatchClass: string
    role: string
}

export const MARKETING_PALETTE: PaletteEntry[] = [
    {
        label: 'Cream',
        token: 'background-page',
        swatchClass: 'bg-background-page',
        role: 'Page ground. Never white.',
    },
    {
        label: 'Pink',
        token: 'background-brand',
        swatchClass: 'bg-background-brand',
        role: 'Section bands. The primary button is action-primary, the same colour.',
    },
    {
        label: 'Yellow',
        token: 'background-accent-yellow',
        swatchClass: 'bg-background-accent-yellow',
        role: 'Marquee (home only), Steps band, mascot body, doodles.',
    },
    {
        label: 'Black',
        token: 'border-default',
        swatchClass: 'bg-border-default',
        role: 'Text, card borders, the card fold. Pure #000 only on button borders and shadows.',
    },
    {
        label: 'Lavender',
        token: 'background-marketing-sky',
        swatchClass: 'bg-background-marketing-sky',
        role: 'Sky bands (no-fees, QR, drop-link, exchange widget). Marketing only, never the app token.',
    },
]

export interface RampStep {
    label: string
    /** font size / line height, px */
    sizePx: number
    leadingPx: number
    /** text-<ramp> plus an explicit !leading override so the specimen renders the number it labels */
    className: string
    sample: string
}

/**
 * The display ramp (weight 1000). The leading numbers are spacing steps:
 * 26 = 104px, 16 = 64px, 11.5 = 46px, 9 = 36px.
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
    siteDoes: string
}

/** Errata against public/press/assets/Peanut_Brand_Guidelines.pdf. The site wins. */
export const BRAND_BOOK_ERRATA: ErrataEntry[] = [
    { pdfRef: 'p.28', bookSays: 'Square corners', siteDoes: 'Pill buttons, 2px-radius cards' },
    {
        pdfRef: 'p.28',
        bookSays: '~2px pure-black borders everywhere',
        siteDoes: '1px #000 on buttons, 2px #161616 on cards',
    },
    { pdfRef: 'pp.2–28', bookSays: 'White pages', siteDoes: 'Cream #faf4f0' },
    { pdfRef: 'p.18', bookSays: 'Body Regular 400', siteDoes: 'Body Medium 500' },
    { pdfRef: 'pp.13–14, 25', bookSays: 'Lavender only behind the logo', siteDoes: 'Lavender is a band ground' },
    { pdfRef: 'pp.10–12', bookSays: 'White sneakers', siteDoes: 'Pink sneakers' },
    { pdfRef: 'pp.10, 30', bookSays: 'Walking mascot leads the key visual', siteDoes: 'Waving-chill pose on the hero' },
    { pdfRef: 'p.30', bookSays: 'Nav bar', siteDoes: 'Back circle + locale switcher strip' },
    {
        pdfRef: 'p.1 vs p.31',
        bookSays: '"Version 1 – 30.10.2024" on the back page',
        siteDoes: 'Cover label v1.2 is the version',
    },
]

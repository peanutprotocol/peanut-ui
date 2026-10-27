import type { Locale } from '@/i18n/types'

/** f2: the fold's h2. */
export interface HomeGetPaidStrings {
    /** e.g. "Get paid from the US and Europe." */
    heading: string
}

export interface HomeGetPaidFoldProps {
    strings: HomeGetPaidStrings
}

/** f4: request strips beside "Just send a link." */
export interface HomeRequestStrings {
    /** The h2, e.g. "Just send a link.". */
    heading: string
    /** Request strip caption with a `{username}` slot, e.g. "{username} is requesting". */
    requesting: string
    /** Paid strip line, e.g. "Paid". */
    paid: string
    /** Screen-reader text of the strips, with `{main}`, `{amount}` and `{payer}` slots. */
    chatLabel: string
}

export interface HomeRequestFoldProps {
    strings: HomeRequestStrings
    /** Page locale: writes the requested amount in the reader's dollar format. */
    locale: Locale
}

/** f7: two till stickers beside "Pay like a local." */
export interface HomePayLocalStrings {
    /** The h2, e.g. "Pay like a local.". */
    heading: string
    /** One line with `{argentina}` and `{brazil}` slots; each becomes a link to its QR page. */
    lead: string
    /** Country name for the `{argentina}` link and the Mercado Pago sticker caption. */
    argentina: string
    /** Country name for the `{brazil}` link and the Pix sticker caption. */
    brazil: string
}

export interface HomePayLocalFoldProps {
    strings: HomePayLocalStrings
    /** Page locale: tags the stickers' marketing QR codes and picks the country pages they link to. */
    locale: Locale
}

export interface HomePayLocalLeadProps {
    /** The lead with its `{argentina}` and `{brazil}` slots. */
    lead: string
    names: { argentina: string; brazil: string }
    hrefs: { argentina: string; brazil: string }
}

/** Marquee words per seam, named by the fold above the strip (footer = under the close). */
export interface HomeSeamStrings {
    accounts: string[]
    personas: string[]
    link: string[]
    balance: string[]
    card: string[]
    passkey: string[]
    accountFees: string[]
    /** Under the fee fold: social words leading into the real posts, so the fees are said once, in the fold. */
    wallOfLove: string[]
    faq: string[]
    close: string[]
    footer: string[]
}

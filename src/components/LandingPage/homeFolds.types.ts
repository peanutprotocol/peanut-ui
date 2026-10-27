import type { Locale } from '@/i18n/types'

/** f2: the h2 "Get paid from" over the Knerd "US\nand Europe". */
export interface HomeGetPaidStrings {
    /** Roboto line of the h2, e.g. "Get paid from". */
    lead: string
    /** Knerd lines of the h2, "\n" between them, e.g. "US\nand Europe". */
    knerd: string
    /** The small Roboto word inside `knerd`, e.g. "and". */
    join: string
}

export interface HomeGetPaidFoldProps {
    strings: HomeGetPaidStrings
}

/** f4: request strips beside "Paid by someone on Peanut? Send a link." */
export interface HomeRequestStrings {
    /** First sentence of the h2, e.g. "Paid by someone on Peanut?". */
    question: string
    /** Second sentence of the h2, e.g. "Send a link.". */
    action: string
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
    transferFees: string[]
    faq: string[]
    close: string[]
    footer: string[]
}

/**
 * Merchant landing page data.
 *
 * Hand-edited until v3 (when this likely moves to a server payload or CMS).
 * Each entry feeds `<MerchantLandingPage>` — keep the shape stable.
 *
 * Source content: mono/inbox/merchant-landing-pages/{stain,aleph,badigitalnomads}.html
 * Background research: mono/inbox/merchant-landing-pages/buenos-aires-research.md
 */

export type MenuItem = {
    name: string
    /** Base price in ARS — the merchant's local currency. Converted to USD/EUR client-side. */
    priceARS: number
}

export type FaqItem = {
    id: string
    question: string
    answer: string
}

export type Merchant = {
    slug: string
    /** Used in <title> and as the "X × peanut" co-brand. */
    name: string
    /** Meta description for SEO. */
    metaDescription: string

    // ===== Hero =====
    /** Big lowercase headline. Multi-line by default. */
    heading: string
    /** Uppercase sub headline — the pitch line. May contain `$X` which gets wrapped in the highlight pill. */
    sub: string
    /** Regular-weight body paragraph below the sub. */
    body: string
    /** Label below the big $10 on the deal card. */
    dealLabel: string
    /** Primary CTA text in the hero. */
    primaryCta: string
    /** Secondary link text + anchor target. */
    secondaryLink: { label: string; href: string }
    /** Optional chip row below the body (Aleph: "USDC / Arbitrum / Self-custody / No seed phrases"). */
    chips?: string[]

    // ===== Marquee =====
    marquee: string[]

    // ===== Fold 2 =====
    fold2:
        | { type: 'menu'; heading: string; tagline: string; items: MenuItem[]; showLiveRate: boolean }
        | { type: 'faq'; heading: string; questions: FaqItem[]; liveRateQuestionId?: string }

    // ===== Fold 3 =====
    install: {
        sub: string
    }
    /** BA Digital Nomads: ambassador call-to-action under the install button. */
    ambassador?: {
        kicker: string
        heading: string
        body: string
        applyHref: string
        applyLabel: string
        fine: string
    }

    /** Aleph only: footer disclosure about the $10-per-signup affiliate. */
    footerDisclosure?: string

    /** Optional venue-specific assets. All paths are public/-relative. */
    branding?: {
        /** Small logo for the `peanut × <slug>` lockup on the deal card. Rendered ~16-20px. */
        logoSrc?: string
        /** Override the lockup text. Defaults to merchant.slug (or 'ba nomads' for badigitalnomads). */
        lockupName?: string
    }

    /**
     * Polaroid-style venue photos pinned around the hero deal card.
     * Rendered desktop-only (md:block). 0–3 polaroids per merchant.
     * Position is `tl` (top-left of right column) or `br` (bottom-right of right column).
     */
    polaroids?: Array<{
        src: string
        alt: string
        caption: string
        rotation: number
        position: 'tl' | 'br'
    }>
}

const ARS = (n: number) => n

export const MERCHANTS: Record<string, Merchant> = {
    stain: {
        slug: 'stain',
        name: 'Stain Coffee',
        metaDescription:
            'Your first $10 at Stain Coffee in Palermo Hollywood is on us. Pay with Peanut at the Mercado Pago QR.',
        heading: 'free coffee.',
        sub: 'Your first $10 at Stain is on us.',
        body: 'Scan the Mercado Pago QR at the counter — espresso, cold brew, the tiramisu, the avo toast. First ten bucks on us.',
        dealLabel: 'on the house',
        primaryCta: 'GET PEANUT',
        secondaryLink: { label: 'see the menu →', href: '#menu' },
        marquee: ['FREE COFFEE', 'NO ARS BANK NEEDED', 'PEANUT × STAIN', 'PALERMO HOLLYWOOD', 'CRIPTO DÓLAR RATE'],
        fold2: {
            type: 'menu',
            heading: 'THE MENU.',
            tagline: 'Pick your currency. The app handles the rest.',
            showLiveRate: true,
            // Items + prices verified against Stain's authoritative menu
            // (_temp/STAIN - Menu (EN).xlsx). Name + price only — descriptions
            // dropped because the source has empty desc cells for most items
            // and inventing copy on a co-branded page is a marketing risk.
            items: [
                { name: 'Medialuna', priceARS: ARS(4400) },
                { name: 'Cinnamon Roll', priceARS: ARS(5500) },
                { name: 'Honey Butter Toast', priceARS: ARS(6200) },
                { name: 'Flat White', priceARS: ARS(5900) },
                { name: 'Cappuccino', priceARS: ARS(6000) },
                { name: 'Cold Brew', priceARS: ARS(6200) },
                { name: 'Iced Matcha Latte', priceARS: ARS(6500) },
                { name: 'Salted Caramel Latte', priceARS: ARS(7000) },
                { name: 'Creamy Scrambled Eggs', priceARS: ARS(10000) },
                { name: 'Avocado Toast', priceARS: ARS(11500) },
            ],
        },
        install: { sub: '60 seconds. Skip the waitlist. Free coffee.' },
        branding: { logoSrc: '/merchants/stain/profile.jpg' },
        polaroids: [
            {
                src: '/merchants/stain/timeout-hero.jpg',
                alt: 'Stain coffee + avocado toast',
                caption: 'the avo toast',
                rotation: -8,
                position: 'tl',
            },
            {
                src: '/merchants/stain/tripadvisor-2.jpg',
                alt: 'Stain Coffee storefront, El Salvador 5999',
                caption: 'el salvador 5999',
                rotation: 6,
                position: 'br',
            },
        ],
    },
}

export const MERCHANT_SLUGS = Object.keys(MERCHANTS)

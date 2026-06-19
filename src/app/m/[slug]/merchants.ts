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
    /** Merchant-specific invite code (e.g. `STAIN`, `BANOMADS`). Attached
     *  to every CTA on the LP so a stain QR-sticker scan is attributable
     *  separately from a BA Nomads share even when the URL is hand-typed
     *  (and `utm_*` get stripped). Must be registered in
     *  peanut-api-ts/src/utils/invite.ts → SPECIAL_INVITE_CODES_MAP. */
    inviteCode: string

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
        inviteCode: 'STAIN',
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
            // (EN translation). Name + price only — original descriptions were
            // AI-fabricated for items the source had blank desc cells for, so
            // dropped wholesale rather than carry invented marketing copy.
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

    badigitalnomads: {
        slug: 'badigitalnomads',
        inviteCode: 'BANOMADS',
        name: 'BA Digital Nomads',
        metaDescription:
            'Free $10 on your first Mercado Pago payment in Buenos Aires. No DNI, no Argentine bank account needed. For the BA Digital Nomads community.',
        heading: 'stop hunting\nfor cash.',
        sub: 'Free $10 on your first payment. Skip the waitlist.',
        body: 'Pay any Mercado Pago QR in Buenos Aires at the best rate available. No Argentine bank account, no cash hunt, no DNI. Fund with USDC or a bank transfer. Built for nomads, by nomads.',
        dealLabel: 'on us',
        primaryCta: 'GET PEANUT',
        secondaryLink: { label: 'how it works →', href: '#faq' },
        marquee: [
            'FOR NOMADS BY NOMADS',
            'NO DNI',
            'BEST RATES',
            'MERCADO PAGO ANYWHERE',
            'FUND WITH USDC',
            '24/7 SUPPORT',
        ],
        fold2: {
            type: 'faq',
            heading: 'FAQ.',
            liveRateQuestionId: 'exchange-rate',
            questions: [
                {
                    id: 'transfer-or-card',
                    question: 'Does it work like a transfer or a credit card?',
                    answer: 'Neither. Peanut is a wallet that lives on your phone. No bank account, no card swipe, no chargebacks. When you scan a Mercado Pago QR, peanut converts your dollars to pesos at the best rate available, and the merchant gets paid instantly.',
                },
                {
                    id: 'funding',
                    question: 'How do I fund it?',
                    answer: 'Two ways. Crypto: USDC or USDT on Solana, Arbitrum, Base, Tron, Polygon, or Ethereum, and we cover the network fees. Bank: SEPA, ACH, or wire from any country. No Argentine bank account needed.',
                },
                {
                    id: 'receiving',
                    question: 'How do I receive money?',
                    answer: 'Someone sends you a peanut link, or transfers directly to your peanut. Withdraw to a bank in EUR, USD, MXN, or GBP, or just hold it and spend it via Mercado Pago.',
                },
                {
                    id: 'exchange-rate',
                    question: 'What rate do I get?',
                    answer: 'The best rate available, locked the moment you confirm. What you see on the confirmation screen is what you pay.',
                },
                {
                    id: 'fees',
                    question: 'What are the fees?',
                    answer: 'No fee from peanut on deposits, withdrawals, links, or requests. Cross-currency conversions carry a small spread embedded in the rate you see, so the amount on the confirmation screen is the final amount. Network fees are on us.',
                },
                {
                    id: 'kyc',
                    question: 'What about KYC?',
                    answer: "Passport works. No DNI needed. Most people verify in a couple of minutes, and manual review takes 1 to 3 business days if there's a flag. Accepted: passport, national ID, or a US driver's license.",
                },
                {
                    id: 'limits',
                    question: 'Is there a monthly limit?',
                    answer: 'Argentina starts at $2,000/month combined fiat, raisable with a 90-day history or proof of remote income. Crypto deposits and withdrawals have no cap.',
                },
                {
                    id: 'support',
                    question: 'What if something goes wrong?',
                    answer: 'In-app chat around the clock, with a real person usually replying within the hour. Failed payments are reversed automatically.',
                },
            ],
        },
        install: { sub: '60 seconds. Skip the waitlist. $10 on us.' },
        ambassador: {
            kicker: '↓ FOR COMMUNITY ORGANISERS',
            heading: 'Bring peanut to your nomad community.',
            body: "Run a WhatsApp, Telegram, or in-person nomad community? We're piloting an ambassador track. Custom landing page for your group, a per-signup share, and a direct line to the team. Not an MLM; one level deep, transparent rev-share.",
            applyHref:
                'mailto:konrad@peanut.me?subject=Ambassador%20application%20%E2%80%94%20BA%20Digital%20Nomads&body=Who%20are%20you%3F%0A%0AWhy%20would%20you%20be%20a%20great%20ambassador%3F%0A%0ALink%20to%20your%20community%3A%0A%0A',
            applyLabel: 'Apply as an ambassador →',
            fine: 'Replies from konrad@peanut.me, usually within 24h. v1 is a manual review, no automated funnel yet.',
        },
        polaroids: [
            {
                src: '/merchants/badigitalnomads/meetup.avif',
                alt: 'BA Digital Nomads After Office crowd at a Palermo bar',
                caption: 'after office, palermo',
                rotation: -8,
                position: 'tl',
            },
            {
                src: '/merchants/badigitalnomads/coworking.jpg',
                alt: 'Coworking space in Palermo',
                caption: 'weekday cowork',
                rotation: 6,
                position: 'br',
            },
        ],
    },
}

export const MERCHANT_SLUGS = Object.keys(MERCHANTS)
